import frappe
from frappe import _

def validate_all_items_scanned(doc, method):
    """
    Validate that all items are verified before submission
    Only runs if verification mode is enabled
    """
    # Only validate if verification mode is enabled
    if not doc.get('custom_scan_verification_mode'):
        return
    
    # Skip if not submitting
    if doc.docstatus != 1:
        return
    
    unverified_items = []
    
    for item in doc.items:
        if not item.get('custom_verified'):
            unverified_items.append(f"Row {item.idx}: {item.item_code}")
    
    if unverified_items:
        frappe.throw(
            _("Cannot submit - the following items are not verified by scanning:<br><br>") + 
            "<br>".join(unverified_items),
            title=_("Scan Verification Required")
        )
