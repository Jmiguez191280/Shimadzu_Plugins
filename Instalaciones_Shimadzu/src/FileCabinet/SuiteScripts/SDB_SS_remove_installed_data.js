/**
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript       
 */


define(['N/record', 'N/runtime', 'N/search', 'N/format'],
    function (record, runtime, search, format) {
        function execute(context) {
            try {
                var data = runtime.getCurrentScript().getParameter('custscript_ss_data_to_remove');
                log.debug("data", data);
                if (!data) return;
                data = JSON.parse(data);
                var obj = data.objs
                var customrecord_sdb_item_installedSearchObj = search.create({
                    type: "customrecord_sdb_item_installed_rec",
                    filters:
                        [
                            ["custrecord_sdb_item_fulfillment_rec", "anyof", data.itemF],
                            "AND",
                            ["custrecord_sdb_item_rec", "anyof", data.itemsIds]
                        ],
                    columns: [
                        search.createColumn({ name: "custrecord_sdb_line_number_rec", label: "Item line" }),
                        search.createColumn({ name: "custrecord_sdb_item_rec", label: "Item" }),
                        search.createColumn({ name: "custrecord_sdb_inv_adj_installed_rec", label: "Adjustment" })
                    ]
                });
                var searchResultCount = customrecord_sdb_item_installedSearchObj.runPaged().count;
                log.debug("customrecord_sdb_item_installedSearchObj result count", searchResultCount);

                customrecord_sdb_item_installedSearchObj.run().each(function (result) {
                    var obj = data.objs[result.getValue('custrecord_sdb_item_rec') + '_' + result.getValue('custrecord_sdb_line_number_rec')];
                    log.debug("result.getValue('custrecord_sdb_item_rec'", result.getValue('custrecord_sdb_item_rec'));
                    log.debug("result.getValue('custrecord_sdb_line_number_rec'", result.getValue('custrecord_sdb_line_number_rec'));
                    var adjustmentnegative = result.getValue('custrecord_sdb_inv_adj_installed_rec');

                    if (obj) {
                        log.debug("recdelete", result.id);
                        log.debug("adjustmentnegative", adjustmentnegative);
                        var rec = record.load({
                            type: 'customrecord_sdb_item_installed_rec',
                            id: result.id,
                            isDynamic: true,
                        })
                        rec.setValue({
                            fieldId: 'custrecord_sdb_installed_rec',
                            value: false,
                        })
                        rec.setValue({
                            fieldId: 'custrecord_sdb_instaltion_date_rec',
                            value: '',
                        })
                        rec.setValue({
                            fieldId: 'custrecord_sdb_sales_order_rec',
                            value: '',
                        })
                        
                        log.debug(' rec.save();',
                            rec.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            }));

                        if (adjustmentnegative) {
                            var recdelete = record.delete({
                                type:  record.Type.INVENTORY_ADJUSTMENT,
                                id: adjustmentnegative
                            })
                            log.debug("recdelete", recdelete);

                        }

                    }
                    // record.submitFields({
                    //     type: 'customrecord_sdb_item_installed',
                    //     id: result.id,
                    //     values: {
                    //         custrecord_sdb_installed: true,
                    //         custrecord_sdb_instaltion_date: date 
                    //     },


                    // })
                    return true;
                });



            } catch (e) {
                log.debug('execute exception', e);
            }

        }

        return {
            execute: execute
        };
    });
