app_name = "surgishop_delivery_scanner"
app_title = "SurgiShop Delivery Scanner"
app_publisher = "SurgiShop"
app_description = "Scan-to-verify workflow for delivery notes"
app_email = "it@surgishop.com"
app_license = "MIT"
app_version = "1.0.0"

# Apps required for this app
required_apps = ["erpnext"]

# Include JS files
app_include_js = [
    "/assets/surgishop_delivery_scanner/js/delivery_note_scanner.js"
]

# Include CSS files (optional)
# app_include_css = "/assets/surgishop_delivery_scanner/css/custom.css"

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

# Scheduled Tasks
# scheduler_events = {
#     "all": [
#         "surgishop_delivery_scanner.tasks.all"
#     ],
#     "daily": [
#         "surgishop_delivery_scanner.tasks.daily"
#     ],
# }

# Override standard methods
# override_whitelisted_methods = {
#     "frappe.desk.doctype.event.event.get_events": "surgishop_delivery_scanner.overrides.get_events"
# }

# Permissions
# permission_query_conditions = {
#     "Delivery Note": "surgishop_delivery_scanner.queries.delivery_note_query"
# }
