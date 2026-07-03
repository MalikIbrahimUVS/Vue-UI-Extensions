import frappe

no_cache = 1


def get_context(context):
	from crm.www.crm import get_boot

	frappe.db.commit()
	context.boot = get_boot()
	if frappe.session.user != "Guest":
		from frappe.utils.telemetry import capture

		capture("active_site", "crm")
	return context
