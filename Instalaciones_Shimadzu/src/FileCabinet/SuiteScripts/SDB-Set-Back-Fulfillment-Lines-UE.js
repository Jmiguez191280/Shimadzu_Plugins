/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/log', 'N/search'], function (log, search) {

    function beforeLoad(context) {
        try {
            var thisRecord = context.newRecord;
            //var objLines = JSON.parse(thisRecord.getValue('custbody_sdb_fake_serial_lines'));
            var count = thisRecord.getLineCount({
                sublistId: 'item'
            })
            return
            for (var i = 0; i < count; i++) {
                //var obj = objLines.find(o => o.index == i);
            
               // if (obj) {
               
                    var index = 0;
                    thisRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemreceive',
                        line: i,
                        value: true
                    })
                   
                    var objSubrecord = thisRecord.viewSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail',
                        line: i
                    })
                    var hasSubrecord = objRecord.hasSubrecord({
                        fieldId: 'inventorydetail'
                    });
                    log.debug("hasSubrecord: ", hasSubrecord)
              log.debug("subrec: ", subrec)
                    return;
                    var objSubrecord = thisRecord.getSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail',
                        line: i
                    })
                    var quantity = objSubrecord.getValue('quantity');

                    var itemSearchObj = search.create({
                        type: "item",
                        filters:
                            [
                                ["internalid", "anyof", obj.itemId]
                            ],
                        columns:
                            [
                                "serialnumber"
                            ]
                    });
                    itemSearchObj.run().each(function (result) {
                        objSubrecord.setSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'receiptinventorynumber',
                            line: index,
                            value: result.getValue('serialnumber'),
                        });
                        objSubrecord.setSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'inventorystatus',
                            line: index,
                            value: '0',
                        });
                        objSubrecord.setSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            line: index,
                            value: 1,
                        });
                        index++;
                        if (index == quantity - 1) {
                            return false
                        }
                        else {
                            return true;
                        }
                    });
               // }
            }
        } catch (e) {
            log.debug('error', e)
        }
    }

    return {
        beforeLoad: beforeLoad
    }
});
