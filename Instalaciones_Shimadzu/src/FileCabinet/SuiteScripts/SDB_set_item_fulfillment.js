/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search', 'N/record'], function (search, record) {

    function afterSubmit(context) {
        if (context.type == context.UserEventType.DELETE) return;
        let newRec = context.newRecord;
        let oldRec = context.oldRecord;
        const rec = record.load({
            type: 'customrecord_sdb_item_installed_2',
            id: newRec.id,
            isDynamic: true,
        });
        const edit = newRec.getValue('custrecord_sdb_installed_2') !== oldRec.getValue('custrecord_sdb_installed_2');
        if (edit && newRec.getValue('custrecord_sdb_installed_2')) {
            rec.setValue('custrecord_sdb_instaltion_date_2', new Date());
            const createdfrom = search.lookupFields({
                type: record.Type.ITEM_FULFILLMENT,
                id: rec.getValue('custrecord_sdb_item_fulfillment_2'),
                columns: 'createdfrom'
            }).createdfrom;
            log.debug('createdfrom', createdfrom);
            if (createdfrom) {
                rec.setValue('custrecord_sdb_sales_order_2', createdfrom[0].value);

            }

            // Creating Inventory Adjustment
            const data = {}
            data.itemFulFill = rec.getValue('custrecord_sdb_item_fulfillment_2');
            data.subsidiary = rec.getValue('custrecord_sdb_subsidiary_2');
            data.location = rec.getValue('custrecord_sdb_location_2');
            data.accountId = rec.getValue('custrecord_sdb_account_2');
            data.item = {
                item: rec.getValue('custrecord_sdb_item_2'),
                lotNumbners: rec.getValue('custrecord_sdb_serial_num_2'),
                qty: rec.getValue('custrecord_sdb_qty_installed_2'),
            };
            var itemType = search.lookupFields({
                type: 'item',
                id: data.item.item,
                columns: ['type', 'recordtype']
            });
            data.item.itemType = itemType.recordtype;
            // Search if adjustment already exists
            let invAlreadyExists = false;
            if (itemType.recordtype === 'serializedinventoryitem') {
                let inventoryadjustmentSearchObj = search.create({
                    type: "inventoryadjustment",
                    filters:
                        [
                            ["type", "anyof", "InvAdjst"],
                            "AND",
                            ["item", "anyof", data.item.item],
                            "AND",
                            ["inventorydetail.inventorynumber", "anyof", data.item.lotNumbners],
                            "AND",
                            ["location", "anyof", data.location],
                            "AND",
                            ["amount", "lessthan", "0.00"]
                        ],
                    columns: []
                });
                invAlreadyExists = inventoryadjustmentSearchObj.runPaged().count !== 0
            } else {
                let inventoryadjustmentSearchObj = search.create({
                    type: "inventoryadjustment",
                    filters:
                        [
                            ["type", "anyof", "InvAdjst"],
                            "AND",
                            ["item", "anyof", data.item.item],
                            "AND",
                            ["location", "anyof", data.location],
                            "AND",
                            ["amount", "lessthan", "0.00"]
                        ],
                    columns: []
                });
                invAlreadyExists = inventoryadjustmentSearchObj.runPaged().count !== 0
            }
            log.debug('invAlreadyExists', invAlreadyExists);
            if (!invAlreadyExists) {
                const invAdjId = createAdjustment(data, newRec.id);
                rec.setValue('custrecord_sdb_inv_adj_installed_2', invAdjId);
                record.submitFields({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: rec.getValue('custrecord_sdb_item_fulfillment_2'),
                    values: {
                        'custbody_sdb_if_installed': true
                    }
                });
                const invoiceId = getInvoice(data.item.item, createdfrom[0].value);
                if (invoiceId) {
                    log.debug('invoiceId', invoiceId);
                    record.submitFields({
                        type: record.Type.INVOICE,
                        id: invoiceId,
                        values: {
                            'custbody_sdb_if_installed': true
                        }
                    });
                }
            }
            rec.save({
                ignoreMandatoryFields: true
            });

        }
    }

    function createAdjustment(data, id) {
        try {
            log.debug('data-->', data);
            var adjutment = record.create({
                type: record.Type.INVENTORY_ADJUSTMENT,
                isDynamic: true,
            })
            adjutment.setValue({
                fieldId: 'subsidiary',
                value: data.subsidiary,
                ignoreFieldChange: true
            })
            if (data.accountId) {
                adjutment.setValue({
                    fieldId: 'account',
                    value: data.accountId,
                    ignoreFieldChange: true
                })
            }
            adjutment.setValue({
                fieldId: 'custbody_sdb_ifulfill_req_install',
                value: data.itemFulFill,
                ignoreFieldChange: true
            })
            if (data.item) {
                var thisItem = data.item;
                log.debug('thisItem', thisItem);
                adjutment.selectNewLine({
                    sublistId: 'inventory'
                });
                adjutment.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'item',
                    value: thisItem.item
                });
                adjutment.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'location',
                    value: data.location
                });
                log.debug('thisItem.qty', thisItem.qty);
                const isSerial = thisItem.itemType === 'serializedinventoryitem';
                adjutment.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'adjustqtyby',
                    value: isSerial ? -1 : -1 * thisItem.qty
                });
                log.debug('thisItem.item', thisItem.item);
                log.debug('isSerial', isSerial);
                if (isSerial) {
                    const subrecordInvDetail = adjutment.getCurrentSublistSubrecord({
                        sublistId: 'inventory',
                        fieldId: 'inventorydetail'
                    });
                    subrecordInvDetail.selectNewLine({
                        sublistId: 'inventoryassignment',
                    })
                    subrecordInvDetail.setCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'receiptinventorynumber',
                        value: thisItem.lotNumbners,
                        forceSyncSourcing: true
                    })
                    const value = subrecordInvDetail.getCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'receiptinventorynumber'
                    });
                    log.debug('value', value);
                    subrecordInvDetail.setCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'inventorystatus',
                        value: 1,
                        forceSyncSourcing: true
                    });

                    subrecordInvDetail.setCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'quantity',
                        value: -1,
                        forceSyncSourcing: true
                    });
                    subrecordInvDetail.commitLine({
                        sublistId: 'inventoryassignment'
                    });
                } else {
                    var subrecord = adjutment.getCurrentSublistSubrecord({
                        sublistId: 'inventory',
                        fieldId: 'inventorydetail'
                    });
                    subrecord.selectNewLine({ sublistId: 'inventoryassignment' });
                    subrecord.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: thisItem.qty * -1 });
                    subrecord.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'inventorystatus', value: 1 });
                    subrecord.commitLine({ sublistId: 'inventoryassignment' });
                    subrecord.removeLine({ sublistId: 'inventoryassignment', line: 1 });
                }
                adjutment.commitLine({ sublistId: 'inventory' });
                adjutment.setValue('custbody_sdb_item_installed_rcd', id);
                adjutment.setValue('custbody_sdb_adj_of_installation', true);
                var recordId = adjutment.save({
                    ignoreMandatoryFields: true
                });
                log.debug('adjustment id', recordId);
                return recordId
            }
        } catch (e) {
            log.debug('e', e);
        }
    }

    function getInvoice(itemId, createdFrom) {
        try {
            let invoiceId;
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
        afterSubmit: afterSubmit
    }
});
