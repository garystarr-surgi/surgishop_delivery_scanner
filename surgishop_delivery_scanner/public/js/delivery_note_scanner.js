/**
 * SurgiShop Delivery Scanner
 * Scan-to-verify workflow for Delivery Notes
 * Does NOT increment quantities - only marks items as verified
 * CAPTURES: Batch No, Serial No, Expiry Date from scanned barcodes
 */

frappe.provide('surgishop.delivery_scanner');

// Track scanned items to prevent duplicates
surgishop.delivery_scanner.scanned_items = {};

/**
 * Delivery Note form customization
 */
frappe.ui.form.on('Delivery Note', {
    refresh: function(frm) {
        // Only activate if verification mode is enabled
        if (!frm.doc.custom_scan_verification_mode) {
            return;
        }
        
        // Add visual indicator
        add_scanner_badge(frm);
        
        // Reset scanned items tracker when form loads
        surgishop.delivery_scanner.scanned_items = {};
        
        // Show scan summary
        show_scan_summary(frm);
    },
    
    custom_scan_verification_mode: function(frm) {
        // When toggled, refresh to show/hide badge
        frm.refresh();
    },
    
    scan_barcode: function(frm) {
        // Only handle if verification mode enabled
        if (!frm.doc.custom_scan_verification_mode) {
            return; // Let standard scanner handle it
        }
        
        const barcode = frm.doc.scan_barcode;
        if (!barcode) return;
        
        // Clear the scan field
        frm.set_value('scan_barcode', '');
        
        // Process the scan
        verify_item_scan(frm, barcode);
    }
});

/**
 * Main verification logic
 * Uses the SurgiShop scanner API to get full item details including batch
 */
function verify_item_scan(frm, barcode) {
    // Use the SurgiShop scanner API to get complete scan details
    frappe.call({
        method: 'surgishop_erp_scanner.surgishop_erp_scanner.api.barcode.scan_barcode',
        args: {
            search_value: barcode,
            ctx: {
                company: frm.doc.company,
                set_warehouse: frm.doc.set_warehouse
            }
        },
        callback: function(r) {
            if (!r.message || !r.message.item_code) {
                // Fallback to basic barcode lookup if SurgiShop scanner not available
                fallback_barcode_lookup(frm, barcode);
                return;
            }
            
            const scan_data = r.message;
            
            // Find matching row in items table
            const row = find_matching_unverified_row(frm, scan_data);
            
            if (!row) {
                frappe.show_alert({
                    message: `Item ${scan_data.item_code} not found in delivery or already verified!`,
                    indicator: 'orange'
                }, 5);
                frappe.utils.play_sound('error');
                return;
            }
            
            // Mark as verified and populate batch/serial data
            mark_row_verified(frm, row, scan_data);
        },
        error: function() {
            // Fallback if API not available
            fallback_barcode_lookup(frm, barcode);
        }
    });
}

/**
 * Fallback barcode lookup if SurgiShop scanner API not available
 */
function fallback_barcode_lookup(frm, barcode) {
    frappe.call({
        method: 'erpnext.stock.get_item_details.get_item_code',
        args: {
            barcode: barcode
        },
        callback: function(r) {
            if (!r.message) {
                frappe.show_alert({
                    message: `Barcode not found: ${barcode}`,
                    indicator: 'red'
                }, 5);
                frappe.utils.play_sound('error');
                return;
            }
            
            const scan_data = {
                item_code: r.message,
                barcode: barcode
            };
            
            // Find matching row
            const row = find_matching_unverified_row(frm, scan_data);
            
            if (!row) {
                frappe.show_alert({
                    message: `Item ${scan_data.item_code} not found in delivery or already verified!`,
                    indicator: 'orange'
                }, 5);
                frappe.utils.play_sound('error');
                return;
            }
            
            // Mark as verified
            mark_row_verified(frm, row, scan_data);
        }
    });
}

/**
 * Find first unverified row matching the scanned item
 * Considers batch_no if scanning a GS1 barcode with batch
 */
function find_matching_unverified_row(frm, scan_data) {
    const items = frm.doc.items || [];
    const scanned_item_code = scan_data.item_code;
    const scanned_batch = scan_data.batch_no || null;
    
    // First, try to find exact match (item + batch if batch tracking)
    if (scanned_batch) {
        for (let item of items) {
            if (item.item_code === scanned_item_code && 
                !item.custom_verified &&
                (!item.batch_no || item.batch_no === scanned_batch)) {
                return item;
            }
        }
    }
    
    // If no batch match or no batch scanned, find any unverified row for this item
    for (let item of items) {
        if (item.item_code === scanned_item_code && !item.custom_verified) {
            return item;
        }
    }
    
    return null;
}

/**
 * Mark a row as verified and populate batch/serial/expiry data from scan
 */
function mark_row_verified(frm, row, scan_data) {
    const updates = {
        custom_verified: 1
    };
    
    // Populate batch number if scanned
    if (scan_data.batch_no && frappe.meta.has_field(row.doctype, 'batch_no')) {
        updates.batch_no = scan_data.batch_no;
        
        // Fetch and populate batch expiry date
        if (frappe.meta.has_field(row.doctype, 'custom_expiration_date')) {
            frappe.db.get_value('Batch', scan_data.batch_no, 'expiry_date', (r) => {
                if (r && r.expiry_date) {
                    frappe.model.set_value(row.doctype, row.name, 'custom_expiration_date', r.expiry_date);
                }
            });
        }
    }
    
    // Populate serial number if scanned
    if (scan_data.serial_no && frappe.meta.has_field(row.doctype, 'serial_no')) {
        const existing_serials = row.serial_no || '';
        updates.serial_no = existing_serials ? 
            existing_serials + '\n' + scan_data.serial_no : 
            scan_data.serial_no;
    }
    
    // Populate barcode field if exists
    if (scan_data.barcode && frappe.meta.has_field(row.doctype, 'barcode')) {
        updates.barcode = scan_data.barcode;
    }
    
    // Apply all updates
    frappe.model.set_value(row.doctype, row.name, updates);
    
    // Track this scan
    const scan_key = `${row.item_code}_${row.idx}`;
    surgishop.delivery_scanner.scanned_items[scan_key] = true;
    
    // Build feedback message
    let message = `Row ${row.idx}: ${row.item_code} verified ✓`;
    if (scan_data.batch_no) {
        message += ` (Batch: ${scan_data.batch_no})`;
    }
    if (scan_data.serial_no) {
        message += ` (S/N: ${scan_data.serial_no})`;
    }
    
    // Visual feedback
    frappe.show_alert({
        message: message,
        indicator: 'green'
    }, 4);
    frappe.utils.play_sound('submit');
    
    // Refresh the items table to show checkmark
    frm.refresh_field('items');
    
    // Update summary
    show_scan_summary(frm);
    
    // Highlight the row briefly
    highlight_verified_row(frm, row.idx);
}

/**
 * Show scan completion summary
 */
function show_scan_summary(frm) {
    const items = frm.doc.items || [];
    const total = items.length;
    const verified = items.filter(i => i.custom_verified).length;
    
    // Remove old summary
    frm.dashboard.clear_headline();
    
    if (total === 0) return;
    
    const percent = Math.round((verified / total) * 100);
    let indicator = 'orange';
    
    if (percent === 100) {
        indicator = 'green';
    } else if (percent >= 50) {
        indicator = 'blue';
    }
    
    frm.dashboard.set_headline_alert(
        `<div style="font-size: 16px; font-weight: 600;">
            Scan Progress: ${verified} of ${total} items verified (${percent}%)
        </div>`,
        indicator
    );
}

/**
 * Highlight a verified row
 */
function highlight_verified_row(frm, row_idx) {
    // Get the row element
    setTimeout(() => {
        const row_selector = `.grid-row[data-idx="${row_idx}"]`;
        const $row = frm.fields_dict.items.grid.wrapper.find(row_selector);
        
        if ($row.length) {
            // Flash green background
            $row.css({
                'background-color': '#d4edda',
                'transition': 'background-color 0.3s'
            });
            
            setTimeout(() => {
                $row.css('background-color', '');
            }, 1500);
        }
    }, 100);
}

/**
 * Add visual indicator that verification mode is active
 */
function add_scanner_badge(frm) {
    // Check if badge already exists
    if (frm.fields_dict.scan_barcode.$wrapper.find('.verification-badge').length > 0) {
        return;
    }
    
    const badge = $(`
        <span class="verification-badge" 
              style="display: inline-flex; align-items: center; 
                     margin-left: 8px; padding: 3px 10px; 
                     background: #d4edda; color: #155724; 
                     border-radius: 4px; font-size: 12px;
                     font-weight: 600; border: 1px solid #c3e6cb;">
            <svg style="width:14px;height:14px;margin-right:4px" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/>
            </svg>
            Verification Mode
        </span>
    `);
    
    const label = frm.fields_dict.scan_barcode.$wrapper.find('.control-label');
    if (label.length > 0) {
        label.append(badge);
    }
}
