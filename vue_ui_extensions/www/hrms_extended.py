import frappe

no_cache = 1


def get_context(context):
	from hrms.www.hrms import get_boot

	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()  # nosemgrep
	context.csrf_token = csrf_token
	context.boot = get_boot()
	context.site_name = frappe.local.site
	return context
