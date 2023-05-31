/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

//SDB_set_item_fulfillment.js
define(['N/search', 'N/record'], function (search, record) {

    function beforeSubmit(context) {
        try {
            var rcdId = context.newRecord.id;
            log.debug('context.type ', context.type);
            log.debug('rcdId ', rcdId);

        } catch (e) {
            log.debug('beforeSubmit error', e);
        }
    }
    function afterSubmit(context) {
        try {
            log.debug('afterSubmit ', 'executo');
            if (context.type == context.UserEventType.DELETE) return;
            var newRec = context.newRecord;
            var oldRec = context.oldRecord;
           

            var rec = search.lookupFields({
                type: 'customrecord_sdb_item_installed_rec',
                id: newRec.id,
                columns: ['custrecord_sdb_sales_order_rec', 'custrecord_sdb_instaltion_date_rec', 'custrecord_sdb_item_fulfillment_rec', 'custrecord_sdb_subsidiary_rec', 'custrecord_sdb_location_rec',
                    'custrecord_sdb_account_rec', 'custrecord_sdb_item_rec', 'custrecord_sdb_serial_num_rec', 'custrecord_sdb_qty_installed_rec', 'custrecord_sdb_installed_rec']
            })
            log.debug('context.type ', context.type);

            const edit = newRec.getValue('custrecord_sdb_installed_rec') !== oldRec.getValue('custrecord_sdb_installed_rec');

            let nuevo = newRec.getValue('custrecord_sdb_installed_rec');
            let viejo = oldRec.getValue('custrecord_sdb_installed_rec');

            log.debug({ title: 'newRec', details: nuevo });
            log.debug({ title: 'oldRec', details: viejo });
            log.debug({ title: 'edit', details: edit });

            if (edit && newRec.getValue('custrecord_sdb_installed_rec')) {
                if (!newRec.getValue('custrecord_sdb_instaltion_date_rec')) rec.setValue('custrecord_sdb_instaltion_date_rec', new Date());
               
                const createdfrom = rec.custrecord_sdb_sales_order_rec.length ? rec.custrecord_sdb_sales_order_rec[0].value : null;
                // Creating Inventory Adjustment
                const data = {}
                data.itemFulFill = rec.custrecord_sdb_item_fulfillment_rec.length ? rec.custrecord_sdb_item_fulfillment_rec[0].value : '';
                data.subsidiary = rec.custrecord_sdb_subsidiary_rec.length ? rec.custrecord_sdb_subsidiary_rec[0].value : '';
                data.location = rec.custrecord_sdb_location_rec.length ? rec.custrecord_sdb_location_rec[0].value : '';
                data.accountId = rec.custrecord_sdb_account_rec.length ? rec.custrecord_sdb_account_rec[0].value : '';
                data.item = {
                    item: rec.custrecord_sdb_item_rec.length ? rec.custrecord_sdb_item_rec[0].value : '',
                    lotNumbners: rec.custrecord_sdb_serial_num_rec ? rec.custrecord_sdb_serial_num_rec : '',
                    qty: rec.custrecord_sdb_qty_installed_rec ? rec.custrecord_sdb_qty_installed_rec : ''
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

                    log.debug('serialitem data', data);
                    log.debug({
                        title: 'creating inventory adjustment: lot number',
                        details: data.item.lotNumbners
                    })

                    let inventoryadjustmentSearchObj = search.create({
                        type: "inventoryadjustment",
                        filters:
                            [
                                ["type", "anyof", "InvAdjst"],
                                "AND",
                                ["item", "anyof", data.item.item],
                                "AND",
                                ["inventorydetail.inventorynumber", "anyof", getIdSerializedNumber(data.item.lotNumbners)],
                                "AND",
                                ["location", "anyof", data.location],
                                "AND",
                                ["amount", "lessthan", "0.00"]
                            ],
                        columns: []
                    });
                    invAlreadyExists = inventoryadjustmentSearchObj.runPaged().count !== 0
                } else {
                    log.debug('no_serialitem data', data);
                    var customrecord_sdb_item_installed_recSearchObj = search.create({
                        type: "customrecord_sdb_item_installed_rec",
                        filters:
                            [
                                ["custrecord_sdb_inv_adj_installed_rec", "anyof", "@NONE@"],
                                "AND",
                                ["custrecord_sdb_item_rec", "anyof", data.item.item],
                                "AND",
                                ["custrecord_sdb_item_fulfillment_rec", "anyof", data.itemFulFill]
                            ],
                        columns:
                            [
                                search.createColumn({ name: "custrecord_sdb_item_fulfillment_rec", label: "Item Fulfillment" }),
                            ]
                    });
                    var searchResultCount = customrecord_sdb_item_installed_recSearchObj.runPaged().count;
                    log.debug("customrecord_sdb_item_installed_recSearchObj result count", searchResultCount);

                    invAlreadyExists = customrecord_sdb_item_installed_recSearchObj.runPaged().count == 0;
                }
                log.debug('invAlreadyExists', invAlreadyExists);
                var fullInstalled = validateInstaledCount(data.itemFulFill);
                log.debug('fullInstalled', fullInstalled);
                if (!invAlreadyExists) {// Si para este item no hay adjustment negativo en IAC se crea.
                    log.debug('data<><>', data);
                    const invAdjId = createAdjustment(data, newRec.id);


                    //    rec.setValue('custrecord_sdb_inv_adj_installed_rec', invAdjId);
                    record.submitFields({
                        type: 'customrecord_sdb_item_installed_rec',
                        id: newRec.id,
                        values: {
                            'custrecord_sdb_inv_adj_installed_rec': invAdjId,
                        }
                    });
                   
                    if (fullInstalled) {// Si esta totalmente instalado se chequea como Installed
                      
                        record.submitFields({
                            type: record.Type.ITEM_FULFILLMENT,
                            id: data.itemFulFill,
                            values: {
                                custbody_sdb_if_installed: true
                            }

                        })
                    }
                    let invoiceId = null;
                    invoiceId = getInvoice(data.item.item, createdfrom);
                    if (invoiceId && fullInstalled) {// Si esta totalmente instalado se chequea como Installed en la invoice
                      
                        log.debug('encontro invoice', invoiceId)
                        record.submitFields({
                            type: record.Type.INVOICE,
                            id: invoiceId,
                            values: {
                                'custbody_sdb_if_installed': true
                            }
                        });
                       
                        var SOid = createdfrom;
                       
                    }

                    if (SOid && fullInstalled) {
                        log.debug('encontro SO', SOid)
                       
                        record.submitFields({
                            type: record.Type.SALES_ORDER,
                            id: SOid,
                            values: {
                                'custbody_sdb_if_installed': true
                            }
                        });
                    }
                }
                // rec.save({
                //     ignoreMandatoryFields: true
                // });
            }
            //dpe
        } catch (e) {
            log.error('afterSubmit error:', e);

            record.submitFields({
                type: 'customrecord_sdb_item_installed_rec',
                id: newRec.id,
                values: {
                    'custbody_sdb_if_installed': false,
                    'custrecord_sdb_instaltion_date_rec': null,
                    'custrecord_sdb_ir_errormessage': 'ERROR create record: ' + e.message
                }
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

            adjutment.setValue({
                fieldId: 'custbody_sdb_install_gl_usage',
                value: true,
                ignoreFieldChange: true
            })
            adjutment.setValue({
                fieldId: 'custbody_sdb_adj_for_istallation',
                value: true,
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
            record.submitFields({
                type: 'customrecord_sdb_item_installed_rec',
                id: id,
                values: {
                    'custrecord_sdb_ir_errormessage': 'ERROR createAdjustment (-): ' + e.message
                }
            });
        }
    }

    //Valida que esten el total de item instalados para setear inoice y item fulflillment 
    function validateInstaledCount(itemF) {
        try {
            log.debug('itemF >>', itemF);
            var installed_true = [];
            var fullInstalled = true;
            var customrecord_sdb_item_installedSearchObj = search.create({
                type: "customrecord_sdb_item_installed_rec",
                filters:
                    [
                        ["custrecord_sdb_item_fulfillment_rec", "anyof", itemF]
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
                // log.debug('result.getValue(custrecord_sdb_installed_rec)', result.getValue('custrecord_sdb_installed_rec'));
                if (!result.getValue('custrecord_sdb_installed_rec') || result.getValue('custrecord_sdb_installed_rec') == 'F') {
                    fullInstalled = false;
                    log.debug('installed <<>>', false);
                    return false;

                }
                return true;
            });

            //if (searchResultCount == installed_true.length) fullInstalled = true;

        } catch (e) {
            log.error('error validateInstaledCount', e);
        }
        return fullInstalled
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

    function getIdSerializedNumber(lotNumber) {
        var inventorynumberSearchObj = search.create({
            type: "inventorynumber",
            filters:
                [
                    ["inventorynumber", "is", lotNumber]
                ],
            columns: []
        });
        if (inventorynumberSearchObj.runPaged().count === 0) return;
        let response = '';
        inventorynumberSearchObj.run().each(function (result) {
            response = result.id;
            return false;
        });
        return response;
    }
    return {
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    }

});
