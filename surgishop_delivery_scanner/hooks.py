app_name = "surgishop_delivery_scanner"
app_title = "SurgiShop Delivery Scanner"
app_publisher = "SurgiShop"
app_description = "Scan-to-verify workflow for delivery notes"
app_email = "gary.starr@surgishop.com"
app_license = "MIT"

# Apps required for this app
required_apps = ["erpnext"]

# Include JS files
app_include_js = [
    "/assets/surgishop_delivery_scanner/js/delivery_note_scanner.js"
]

# Fixtures to export/import
fixtures = [
    {
        "dt": "Custom Field",
        "filters": [
            ["name", "in", [
                "Delivery Note Item-custom_verified",
                "Delivery Note-custom_scan_verification_mode"
            ]]
        ]
    }
]

# Document Events
doc_events = {
    "Delivery Note": {
        "validate": "surgishop_delivery_scanner.validations.validate_all_items_scanned"
    }
}
