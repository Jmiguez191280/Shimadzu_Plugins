/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript       
 */

 define(['N/record', 'N/runtime', 'N/search', 'N/format'],
 function (record, runtime, search, format) {
     function execute(context) {
         try {
             var data = runtime.getCurrentScript().getParameter('custscript_sdb_adjustment_data');
             log.debug("data", data);
             if (!data) return;
             wait(10000)
             data = JSON.parse(data);
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
                fieldId: 'custbody_sdb_adj_for_istallation',
                value: true,
                ignoreFieldChange: true
            })
             if (data.items && data.items.length) {
                 for (var i = 0; i < data.items.length; i++) {
                     var thisItem = data.items[i];
                     log.debug('thisItem', thisItem);
                     log.debug('thisItem.lotNumber.length', thisItem.lotNumber.length);
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
                     log.debug('thisItem.item', thisItem.item);

                     const isSerial = thisItem.itemType === 'serializedinventoryitem';

                     log.debug('isSerial', isSerial);

                     adjutment.setCurrentSublistValue({
                         sublistId: 'inventory',
                         fieldId: 'adjustqtyby',
                         value: isSerial ? thisItem.lotNumber.length : thisItem.qty
                     });
                     if (isSerial) {
                         var subrecordInvDetail = adjutment.getCurrentSublistSubrecord({
                             sublistId: 'inventory',
                             fieldId: 'inventorydetail'
                         });
                         thisItem.lotNumber.forEach(elem => {
                             log.debug('serial number', elem)
                             subrecordInvDetail.selectNewLine({
                                 sublistId: 'inventoryassignment',
                             })
                             subrecordInvDetail.setCurrentSublistValue({
                                 sublistId: 'inventoryassignment',
                                 fieldId: 'receiptinventorynumber',
                                 value: elem,
                                 forceSyncSourcing: true
                             })
                             subrecordInvDetail.setCurrentSublistValue({
                                 sublistId: 'inventoryassignment',
                                 fieldId: 'inventorystatus',
                                 value: 1,
                                 forceSyncSourcing: true
                             });
                             subrecordInvDetail.setCurrentSublistValue({
                                 sublistId: 'inventoryassignment',
                                 fieldId: 'quantity',
                                 value: 1,
                                 forceSyncSourcing: true
                             });
                             subrecordInvDetail.commitLine({
                                 sublistId: 'inventoryassignment'
                             });
                         })
                     }
                     adjutment.commitLine({ sublistId: 'inventory' });
                 }
                 var recordId = adjutment.save({
                     ignoreMandatoryFields: true
                 });
                 log.debug('adjustment id', recordId);
             }
         } catch (e) {
             log.debug('execute exception', e);
         }

     }

     function wait(milliseconds) {
         var start = new Date().getTime();
         for (var i = 0; i < 1e7; i++) {
             if ((new Date().getTime() - start) > milliseconds) {
                 break;
             }
         }
     }

     return {
         execute: execute
     };
 });
