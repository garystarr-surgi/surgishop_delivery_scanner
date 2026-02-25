"""
SurgiShop Delivery Scanner - Validation Functions
Ensures all items are verified before submission
"""

import frappe
from frappe import _


def validate_all_items_scanned(doc, method):
    """
    Validate that all items are verified before submission.
    Only runs if verification mode is enabled.
    
    Args:
        doc: The Delivery Note document
        method: The triggering method (validate, before_submit, etc.)
    """
    # Only validate if verification mode is enabled
    if not doc.get('custom_scan_verification_mode'):
        return
    
    # Only validate on submit (docstatus = 1)
    if doc.docstatus != 1:
        return
    
    # Check for unverified items
    unverified_items = []
    
    for item in doc.items:
        if not item.get('custom_verified'):
            unverified_items.append(
                f"Row {item.idx}: {item.item_code} ({item.item_name})"
            )
    
    # Throw error if any items unverified
    if unverified_items:
        message = _(
            "Cannot submit - the following items are not verified by scanning:"
        )
        message += "<br><br>" + "<br>".join(unverified_items)
        message += "<br><br>" + _(
            "Please scan all items before submitting, or disable 'Enable Scan Verification'."
        )
        
        frappe.throw(
            message,
            title=_("Scan Verification Required")
        )
