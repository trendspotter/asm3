/*jslint browser: true, forin: true, eqeq: true, white: true, sloppy: true, vars: true, nomen: true */
/*global $, jQuery, _, asm, common, config, controller, dlgfx, format, header, html, tableform, validate */

$(function() {

    var users = {

        model: function() {
            // Add extra location filter options for fosters and trial adoptions
            controller.internallocations.push(
                { ID: -2, LOCATIONNAME: _("Foster")},
                { ID: -9, LOCATIONNAME: _("Non-shelter")},
                { ID: -8, LOCATIONNAME: _("Retailer")},
                { ID: -1, LOCATIONNAME: _("Trial Adoption")}
            );

            var dialog = {
                add_title: _("Add user"),
                edit_title: _("Edit user"),
                helper_text: _("Users need a username, password and at least one role or the superuser flag setting."),
                close_on_ok: false,
                hide_read_only: true,
                columns: 1,
                width: 550,
                fields: [
                    { json_field: "USERNAME", post_field: "username", label: _("Username"), type: "text", validation: "notblank", readonly: true },
                    { json_field: "PASSWORD", post_field: "password", label: _("Password"), type: "text", readonly: true },
                    { json_field: "REALNAME", post_field: "realname", label: _("Real name"), type: "text" },
                    { json_field: "EMAILADDRESS", post_field: "email", label: _("Email"), type: "text" },
                    { json_field: "SUPERUSER", post_field: "superuser", label: _("Type"),  type: "select", defaultval: 0, options: 
                        '<option value="0">' + _("Normal user") + '</option>' +
                        '<option value="1">' + _("Super user") + '</option>'},
                    { json_field: "ROLEIDS", post_field: "roles", label: _("Roles"), type: "selectmulti", 
                        options: { rows: controller.roles, valuefield: "ID", displayfield: "ROLENAME" }},
                    { json_field: "SITEID", post_field: "site", label: _("Site"), type: "select", 
                        options: html.list_to_options(controller.sites, "ID", "SiteName") },
                    { json_field: "OWNERID", post_field: "person", label: _("Staff record"), type: "person", personfilter: "staff" },
                    { json_field: "LOCATIONFILTER", post_field: "locationfilter", label: _("Location Filter"), type: "selectmulti", 
                        options: { rows: controller.internallocations, valuefield: "ID", displayfield: "LOCATIONNAME" }},
                    { type: "raw", label: "", markup: html.info(_("Setting a location filter will prevent this user seeing animals who are not in these locations on shelterview, find animal and search."))
                    },
                    { json_field: "IPRESTRICTION", post_field: "iprestriction", label: _("IP Restriction"), type: "textarea", classes: "asm-ipbox" },
                    { type: "raw", label: "", markup: html.info(_("IP restriction is a space-separated list of IP netblocks in CIDR notation that this user is *only* permitted to login from (eg: 192.168.0.0/24 127.0.0.0/8). If left blank, the user can login from any address."))
                    }
                ]
            };

            var table = {
                rows: controller.rows,
                idcolumn: "ID",
                edit: function(row) {
                    if (row.USERNAME == asm.useraccount) { return false; }
                    tableform.dialog_show_edit(dialog, row)
                        .then(function() {
                            tableform.fields_update_row(dialog.fields, row);
                            users.set_extra_fields(row);
                            return tableform.fields_post(dialog.fields, "mode=update&userid=" + row.ID, "systemusers");
                        })
                        .then(function(response) {
                            tableform.table_update(table);
                            tableform.dialog_close();
                        });
                },
                columns: [
                    { field: "USERNAME", display: _("Username"), initialsort: true, formatter: function(row) {
                            if (row.USERNAME == asm.useraccount) {
                                return row.USERNAME;
                            }
                            return "<span style=\"white-space: nowrap\">" +
                                "<input type=\"checkbox\" data-id=\"" + row.ID + "\" title=\"" + html.title(_("Select")) + "\" />" +
                                "<a href=\"#\" class=\"link-edit\" data-id=\"" + row.ID + "\">" + row.USERNAME + "</a>" +
                                "</span>";
                        }},
                    { field: "REALNAME", display: _("Real name"), formatter: function(row) {
                            if (row.USERNAME == asm.useraccount) { 
                                return _("(master user, not editable)");
                            }
                            if (row.REALNAME) {                        
                                return row.REALNAME;
                            }
                            return "";
                        }},
                    { field: "EMAILADDRESS", display: _("Email") },
                    { field: "ROLES", display: _("Roles"), formatter: function(row) {
                            return common.nulltostr(row.ROLES).replace(/[|]+/g, ", ");
                        }},
                    { field: "SUPERUSER", display: _("Superuser"), formatter: function(row) {
                            if (row.SUPERUSER == 1) {
                                return _("Yes");
                            }
                            return _("No");
                        }},
                    { field: "SITENAME", display: _("Site"), hideif: function() { return !config.bool("MultiSiteEnabled"); } }, 
                    { field: "LOCATIONFILTER", display: _("Location Filter"), formatter: function(row) {
                        var of = [], lf = common.nulltostr(row.LOCATIONFILTER);
                        if (!row.LOCATIONFILTER) { return ""; }
                        $.each(lf.split(/[\|,]+/), function(i, f) {
                            $.each(controller.internallocations, function(x, v) {
                                if (parseInt(f, 10) == v.ID) {
                                    of.push(v.LOCATIONNAME);
                                    return false;
                                }
                            });
                        });
                        return of.join(", ");
                    }},
                    { field: "IPRESTRICTION", display: _("IP Restriction") }
                ]
            };

            var buttons = [
                 { id: "new", text: _("New User"), icon: "new", enabled: "always", 
                     click: function() { 
                         tableform.dialog_show_add(dialog)
                             .then(function() {
                                 return tableform.fields_post(dialog.fields, "mode=create", "systemusers");
                             })
                             .then(function(response) {
                                 var row = {};
                                 row.ID = response;
                                 tableform.fields_update_row(dialog.fields, row);
                                 users.set_extra_fields(row);
                                 controller.rows.push(row);
                                 tableform.table_update(table);
                                 tableform.dialog_close();
                             })
                             .fail(function() {
                                 tableform.dialog_enable_buttons();   
                             });
                     } 
                 },
                 { id: "delete", text: _("Delete"), icon: "delete", enabled: "multi", 
                     click: function() { 
                         tableform.delete_dialog(null, _("This will permanently remove the selected user accounts. Are you sure?"))
                             .then(function() {
                                 tableform.buttons_default_state(buttons);
                                 var ids = tableform.table_ids(table);
                                 return common.ajax_post("systemusers", "mode=delete&ids=" + ids);
                             })
                             .then(function() {
                                 tableform.table_remove_selected_from_json(table, controller.rows);
                                 tableform.table_update(table);
                             });
                     } 
                 },
                 { id: "reset", text: _("Reset Password"), icon: "auth", enabled: "multi", 
                     click: function() { 
                         $("#dialog-reset").dialog("open");
                     } 
                 }
            ];
            this.dialog = dialog;
            this.table = table;
            this.buttons = buttons;
        },

        render_resetdialog: function() {
            return [
                '<div id="dialog-reset" style="display: none" title="' + html.title(_("Reset Password")) + '">',
                '<table width="100%">',
                '<tr>',
                '<td><label for="newpassword">' + _("New Password") + '</label></td>',
                '<td><input id="newpassword" data="newpassword" type="password" class="asm-textbox" /></td>',
                '</tr>',
                '<tr>',
                '<td><label for="confirmpassword">' + _("Confirm Password") + '</label></td>',
                '<td><input id="confirmpassword" data="confirmpassword" type="password" class="asm-textbox" /></td>',
                '</tr>',
                '</table>',
                '</div>'
            ].join("\n");
        },

        bind_resetdialog: function() {
            var resetbuttons = { }, table = users.table;
            resetbuttons[_("Change Password")] = function() {
                validate.reset("dialog-reset");
                if (!validate.notblank([ "newpassword" ])) { return; }
                if (!validate.notblank([ "confirmpassword" ])) { return; }
                if ($.trim($("#newpassword").val()) != $.trim($("#confirmpassword").val())) {
                    header.show_error(_("New password and confirmation password don't match."));
                    return;
                }
                $("#dialog-reset").disable_dialog_buttons();
                var ids = tableform.table_ids(table);
                common.ajax_post("systemusers", "mode=reset&ids=" + ids + "&password=" + encodeURIComponent($("#newpassword").val()))
                    .then(function() {
                        var h = "";
                        $("#tableform input:checked").each(function() {
                           var username = $(this).next().text();
                           $(this).prop("checked", false);
                           h += _("Password for '{0}' has been reset.").replace("{0}", username) + "<br />";
                        });
                        header.show_info(h);
                    })
                    .always(function() {
                        $("#dialog-reset").dialog("close");
                        $("#dialog-reset").enable_dialog_buttons();
                    });
            };
            resetbuttons[_("Cancel")] = function() {
                $("#dialog-reset").dialog("close");
            };

            $("#dialog-reset").dialog({
                autoOpen: false,
                width: 550,
                modal: true,
                dialogClass: "dialogshadow",
                show: dlgfx.edit_show,
                hide: dlgfx.edit_hide,
                buttons: resetbuttons
            });
        },

        render: function() {
            var s = "";
            this.model();
            s += tableform.dialog_render(this.dialog);
            s += this.render_resetdialog();
            s += html.content_header(_("User Accounts"));
            s += tableform.buttons_render(this.buttons);
            s += tableform.table_render(this.table);
            s += html.content_footer();
            return s;
        },

        bind: function() {
            this.bind_resetdialog();
            tableform.dialog_bind(this.dialog);
            tableform.buttons_bind(this.buttons);
            tableform.table_bind(this.table, this.buttons);
            $("#site").closest("tr").toggle( config.bool("MultiSiteEnabled") );
        },

        set_extra_fields: function(row) {
            // Build list of ROLES from ROLEIDS
            var roles = [];
            var roleids = row.ROLEIDS;
            if ($.isArray(roleids)) { roleids = roleids.join(","); }
            $.each(roleids.split(/[|,]+/), function(i, v) {
                roles.push(common.get_field(controller.roles, v, "ROLENAME"));
            });
            row.ROLES = roles.join("|");
        },

        destroy: function() {
            common.widget_destroy("#dialog-reset");
            common.widget_destroy("#person");
            tableform.dialog_destroy();
        },

        name: "users",
        animation: "options",
        title: function() { return _("Edit system users"); },
        routes: {
            "systemusers": function() { common.module_loadandstart("users", "systemusers"); }
        }

    };
    
    common.module_register(users);

});
