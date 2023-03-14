/**
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript       
    *customscript_sdb_set_cus_rec_instalacion
 */

    define(['N/record', 'N/runtime', 'N/search', 'N/format'],
    function (record, runtime, search, format) {
        function execute(context) {
            try {

                var rcdid = runtime.getCurrentScript().getParameter('custscript_ss_rcdid');
                var items = runtime.getCurrentScript().getParameter('custscript_ss_items');

               
                if (items) { items = JSON.parse(items); }
                log.debug('itemsType', typeof items);
                log.debug("data", rcdid);
                if (!rcdid) return
                var rcdNew = record.load({
                    type: 'customrecord_sdb_item_installed_rec',
                    id: rcdid,
                    isDynamic: true
                })
                var IFid = rcdNew.getValue({
                    fieldId: 'custrecord_sdb_item_fulfillment_rec',
                })

                rcdNew.setValue({
                    fieldId: 'custrecord_sdb_installed_rec',
                    value: true,
                    ignoreFieldChange: true
                })
                var id = rcdNew.save();

                log.debug('id', id);
                if (id) validateFullInstalled(IFid, items)

            } catch (e) {
                record.submitFields({
                    type: 'customrecord_sdb_item_installed_rec',
                    id: rcdid,
                    values: {
                        custrecord_sdb_ir_errormessage: e
                    }
                })
                log.debug('execute exception', e);
            }
        }

        function validateFullInstalled(id, itemFilter) {
            try {
                log.debug('itemF validateFullInstalled >>', id);
                var fullInstalled = true;
                var customrecord_sdb_item_installedSearchObj = search.create({
                    type: "customrecord_sdb_item_installed_rec",
                    filters:
                        [
                            ["custrecord_sdb_item_fulfillment_rec", "anyof", id]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "Internal ID" }),
                            search.createColumn({ name: "custrecord_sdb_installed_rec", label: "Installed" })
                        ]
                });
                var searchResultCount = customrecord_sdb_item_installedSearchObj.runPaged().count;
                log.debug("customrecord_sdb_item_installedSearchObj  count", searchResultCount);
                customrecord_sdb_item_installedSearchObj.run().each(function (result) {
                   //log.debug('result.getValue(custrecord_sdb_installed_rec)', result.getValue('custrecord_sdb_installed_rec'));
                    if (!result.getValue('custrecord_sdb_installed_rec') || result.getValue('custrecord_sdb_installed_rec') == 'F') {
                        fullInstalled = false;
                        log.debug('installed <<>>', false);
                        return false;
                    }
                    return true;
                });

                //if (searchResultCount == installed_true.length) fullInstalled = true;
                if (fullInstalled) {
                    record.submitFields({
                        type: record.Type.ITEM_FULFILLMENT,
                        id: id,
                        values: {
                            custbody_sdb_if_installed: true
                        }
                    })
                    var createdFrom = search.lookupFields({
                        type: record.Type.ITEM_FULFILLMENT,
                        id: id,
                        columns: ['createdfrom', 'memo']
                    })

                    var inv = getInvoice(itemFilter, createdFrom.createdfrom[0].value);
                    var comment = createdFrom.memo;
                    record.submitFields({
                        type: record.Type.INVOICE,
                        id: inv,
                        values: {
                            custbody_sdb_if_installed: true,
                            custbody_sdb__service_report_number: id,
                            custbody_sdb_comments: comment
                        }
                    })
                    record.submitFields({
                        type: record.Type.SALES_ORDER,
                        id: createdFrom.createdfrom[0].value,
                        values: {
                            custbody_sdb_if_installed: true
                        }
                    })
                }
            } catch (e) {
                log.error('error validateInstaledCount', e);
            }
        }

        function getInvoice(itemId, createdFrom) {
            try {
                var invoiceId;
                var invoiceSearchObj = search.create({
                    type: "invoice",
                    filters:
                        [
                            ["type", "anyof", "CustInvc"],
                            "AND",
                            ["item", "anyof", itemId],
                            "AND",
                            ["createdfrom", "anyof", createdFrom]
                        ],
                    columns: []
                });
                var searchResultCount = invoiceSearchObj.runPaged().count;
                log.debug("invoiceSearchObj result count", searchResultCount);
                var myResultSet = invoiceSearchObj.run();
                var resultRange = myResultSet.getRange({
                    start: 0,
                    end: 1
                });
                invoiceId = resultRange[0].id;
                return invoiceId
            } catch (e) {
                log.debug('error getInvoice', e);
            }
        }

        return {
            execute: execute
        };
    }
);
