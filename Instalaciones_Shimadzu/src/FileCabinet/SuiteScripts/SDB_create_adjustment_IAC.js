/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript    
 */
 define(['N/ui/serverWidget', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/file', 'N/config', 'N/format', 'N/log'],

 function (serverWidget, record, runtime, search, task, file, config, format, log) {
     function beforeLoad(context) {
         try {
             var rec = context.newRecord;

             var form_1 = context.form;
             var sublist = form_1.getSublist({
                 id: 'item'
             })

             // var subtextfield = sublist.addField({
             //     id: 'custpage_sdb_qty_to_installed',
             //     type: serverWidget.FieldType.INTEGER,
             //     label: 'QUANTITY TO INSTALL'
             // });
             // subtextfield.updateDisplayType({
             //     displayType: serverWidget.FieldDisplayType.ENTRY
             // })


         } catch (error) {
             log.debug('error', error);
         }
     }
     function afterSubmit(context) {
         var scriptObj = runtime.getCurrentScript();
       log.debug('context.newRecord.getValue(status)', context.newRecord.getValue('status'));
       
         if (context.type == context.UserEventType.DELETE) return;
         var itemIntalled = [];
         if (context.type == context.UserEventType.CREATE /*|| context.type == context.UserEventType.EDIT*/) {
             try {
                 var data = {};
                 var thisRecord = record.load({
                     type: search.Type.ITEM_FULFILLMENT,
                     id: context.newRecord.id,
                     isDynamic: true
                 });
                 var thisRecordOld = context.oldRecord;
                 var locationIAC = scriptObj.getParameter({ name: 'custscript_sdb_location' });
                 var account = scriptObj.getParameter({ name: 'custscript_sdb_account' });
                 var createdFrom = thisRecord.getValue('createdfrom');
                 var status = thisRecord.getText('shipstatus'); //status
                 log.audit('status Create', status);
                 var soData = search.lookupFields({
                     type: 'salesorder',
                     id: createdFrom,
                     columns: ['subsidiary', 'custbody_sdb_requires_installation']
                 })
                 log.debug('soData', soData);
                 if (!soData.custbody_sdb_requires_installation || status != 'Shipped') return;
                 var objsReturn = {};
                 var lineCount = thisRecord.getLineCount({ sublistId: 'item' });
                 objsReturn.itemFulFill = thisRecord.id;
                 objsReturn.subsidiary = soData.subsidiary[0].value;
                 objsReturn.location = locationIAC;
                 objsReturn.accountId = account;
                 //installInfo for custom record
                 var installInfo = {};
                 installInfo.fulfill = thisRecord.id;
                 installInfo.locationIAC = locationIAC;
                 installInfo.accountId = account;
                 installInfo.subsidiary = soData.subsidiary[0].value;

                 var itemsAdj = []
                 var items = []

                 for (var i = 0; i < lineCount; i++) {
                     try {
                         thisRecord.selectLine({
                             sublistId: 'item',
                             line: i
                         });
                         var item = thisRecord.getCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'item'
                         });
                         var itemreceive = thisRecord.getCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'itemreceive',
                         });
                         log.debug('itemreceive', itemreceive);
                         if (!itemreceive) continue;
                         var itemType = search.lookupFields({
                             type: 'item',
                             id: item,
                             columns: ['type', 'recordtype']
                         })
                         // var installed = thisRecord.getSublistValue({
                         //     sublistId: 'item',
                         //     fieldId: 'custcol_sdb_installed',
                         //     line: i
                         // });
                         // log.audit('custpage_sdb_qty_to_installed---> ' + i, thisRecord.getSublistValue({
                         //     sublistId: 'item',
                         //     fieldId: 'custpage_sdb_qty_to_installed',
                         //     line: i
                         // }));
                         log.debug('itemType.type', itemType.type);
                         log.debug('itemType.recordtype', itemType.recordtype);
                         if (itemType.type[0].value != 'InvtPart' || itemType.type[0].value == "OthCharge") continue;
                         var quantity = thisRecord.getCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'quantity',
                             line: i
                         });
                         var irSubRecord = thisRecord.getCurrentSublistSubrecord({
                             sublistId: 'item',
                             fieldId: 'inventorydetail'
                         });
                         var irSubRecLineCount = irSubRecord.getLineCount('inventoryassignment');
                         var lotNumbers = [];
                         for (var j = 0; j < irSubRecLineCount; j++) {
                             irSubRecord.selectLine({
                                 sublistId: 'inventoryassignment',
                                 line: j
                             });
                             var number = irSubRecord.getCurrentSublistText({
                                 sublistId: 'inventoryassignment',
                                 fieldId: 'issueinventorynumber'
                             });
                             var qty = irSubRecord.getCurrentSublistValue({
                                 sublistId: 'inventoryassignment',
                                 fieldId: 'quantity'
                             });
                             log.debug('NUMBER', number)
                             lotNumbers.push(number)
                             items.push({
                                 item: item,
                                 lotNumbners: number,
                                 qty: lotNumbers.length,
                                 itemType: itemType.recordtype
                             })
                         }
                         itemsAdj.push({
                             item: item,
                             lotNumbners: lotNumbers,
                             qty: qty,
                             itemType: itemType.recordtype
                         })
                         // if (installed) {
                         //     var line = thisRecord.getSublistValue({
                         //         sublistId: 'item',
                         //         fieldId: 'custcol_sdb_line_number_custom',
                         //         line: i,
                         //     });
                         //     var intalationDate = thisRecord.getSublistValue({
                         //         sublistId: 'item',
                         //         fieldId: 'custcol_sdb_date_of_installation',
                         //         line: i,
                         //     });
                         //     var date = format.parse({ value: intalationDate, type: format.Type.DATE });

                         //     thisRecord.setSublistValue({
                         //         sublistId: 'item',
                         //         fieldId: 'custcol_sdb_date_of_installation',
                         //         line: i,
                         //         value: date
                         //     });

                         // itemIntalled.push({
                         //     item: item,
                         //     qty: quantity,
                         //     date: date,
                         //     line: line
                         // })
                         // }
                     } catch (e) {
                         log.debug('afterSubmit error in for I', e);
                     }
                 }
                 objsReturn.items = itemsAdj;
                 installInfo.items = items;
                 installInfo.saleOrder = createdFrom;
                 if (context.type == context.UserEventType.CREATE) createAdjustment(objsReturn);
                 if (items.length > 0 && createdFrom) /*updateSoLines(createdFrom, itemIntalled);*/ createRecordInstalled(installInfo);
             } catch (e) {
                 log.debug('afterSubmit create adjustent info', e);
             }
         } else if (context.type == context.UserEventType.EDIT) {
             try {
                 var data = {};
                 var thisRecord = record.load({
                     type: search.Type.ITEM_FULFILLMENT,
                     id: context.newRecord.id,
                     isDynamic: true
                 });
                 var thisRecordOld = context.oldRecord;
                 var locationIAC = scriptObj.getParameter({ name: 'custscript_sdb_location' });
                 var account = scriptObj.getParameter({ name: 'custscript_sdb_account' });
                 var createdFrom = thisRecord.getValue('createdfrom');
                 var oldStatus = thisRecordOld.getText('shipstatus');//old status
                 var status = thisRecord.getText('shipstatus');//status
                 log.audit('status edit', status);
                 var soData = search.lookupFields({
                     type: 'salesorder',
                     id: createdFrom,
                     columns: ['subsidiary', 'custbody_sdb_requires_installation']
                 })

                 log.debug('soData', soData);
                 if (/*!soData.custbody_sdb_requires_installation && */oldStatus == 'Shipped') return;
                 var lineCount = thisRecord.getLineCount({ sublistId: 'item' });
                 //installInfo for custom record
                 var installInfo = {};
                 installInfo.fulfill = thisRecord.id;
                 installInfo.locationIAC = locationIAC;
                 installInfo.accountId = account;
                 installInfo.subsidiary = soData.subsidiary[0].value;

                 var items = []

                 for (var i = 0; i < lineCount; i++) {

                     try {
                         var item = thisRecord.getCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'item',

                         });

                         var itemreceive = thisRecord.getCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'itemreceive',

                         });
                         log.debug('itemreceive', itemreceive);
                         if (!itemreceive) continue;
                         var itemType = search.lookupFields({
                             type: 'item',
                             id: item,
                             columns: ['type']
                         })


                         // var installed = thisRecord.getSublistValue({
                         //     sublistId: 'item',
                         //     fieldId: 'custcol_sdb_installed',
                         //     line: i
                         // });
                         // var fully_installed = thisRecord.getSublistValue({
                         //     sublistId: 'item',
                         //     fieldId: 'custcol_sdb_installed',
                         //     line: i,
                         // });
                         // var fully_installedOld = thisRecordOld.getSublistValue({
                         //     sublistId: 'item',
                         //     fieldId: 'custcol_sdb_installed',
                         //     line: i,
                         //  });
                         // log.audit('custpage_sdb_qty_to_installed---> ' + i, thisRecord.getSublistValue({
                         //     sublistId: 'item',
                         //     fieldId: 'custpage_sdb_qty_to_installed',
                         //     line: i
                         // }));
                         log.debug('itemType.type', itemType.type);
                         if ((itemType.type[0].value != 'InvtPart' || itemType.type[0].value == "OthCharge") /*&& fully_installedOld*/) continue;


                         var quantity = thisRecord.getCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'quantity',
                             line: i
                         });
                         var irSubRecord = thisRecord.getCurrentSublistSubrecord({
                             sublistId: 'item',
                             fieldId: 'inventorydetail'
                         });
                         var irSubRecLineCount = irSubRecord.getLineCount('inventoryassignment');
                         for (var j = 0; j < irSubRecLineCount; j++) {
                             irSubRecord.selectLine({
                                 sublistId: 'inventoryassignment',
                                 line: j
                             });
                             var number = irSubRecord.getCurrentSublistText({
                                 sublistId: 'inventoryassignment',
                                 fieldId: 'issueinventorynumber'
                             });
                             var qty = irSubRecord.getCurrentSublistValue({
                                 sublistId: 'inventoryassignment',
                                 fieldId: 'quantity'
                             });
                             log.debug('serie', number);
                             items.push({
                                 item: item,
                                 lotNumbner: number,
                                 qty: qty,
                             })
                         }

                     } catch (e) {
                         log.debug('afterSubmit error in for I', e);
                     }
                 }

                 installInfo.items = items;

                 if (items.length > 0 && createdFrom)/*updateSoLines(createdFrom, itemIntalled);*/ createRecordInstalled(installInfo);
             } catch (e) {
                 log.debug('afterSubmit error install info', e);
             }
         }
     }
     // function beforeSubmit(context) {
     //     try {
     //         if (context.type != context.UserEventType.EDIT || context.type == context.UserEventType.DELETE) return

     //         var scriptObj = runtime.getCurrentScript();
     //         var locationIAC = scriptObj.getParameter({ name: 'custscript_sdb_location' });
     //         var account = scriptObj.getParameter({ name: 'custscript_sdb_account' });
     //         var thisRecord = context.newRecord;
     //         var thisRecordOld = context.oldRecord;
     //         var itemF = thisRecord.id;

     //         var createdFrom = thisRecord.getValue('createdfrom');
     //         var status = thisRecord.getText('shipstatus');//status
     //         log.audit('status Edit', status);
     //         var items = [];
     //         var lineCount = thisRecord.getLineCount({ sublistId: 'item' });
     //         log.debug('lineCount', lineCount);
     //         var installInfo = {};
     //         installInfo.fulfill = itemF;
     //         installInfo.locationIAC = locationIAC;
     //         installInfo.accountId = account;

     //         var soData = search.lookupFields({
     //             type: 'salesorder',
     //             id: createdFrom,
     //             columns: ['subsidiary', 'custbody_sdb_requires_installation']
     //         })
     //         installInfo.subsidiary = soData.subsidiary[0].value;
     //         log.debug('soData', soData);
     //         if (!soData.custbody_sdb_requires_installation || status != 'Shipped') return;
     //         installInfo.items = items;
     //         for (var i = 0; i < lineCount; i++) {

     //             try {
     //                 var item = thisRecord.getSublistValue({
     //                     sublistId: 'item',
     //                     fieldId: 'item',
     //                     line: i
     //                 });

     //                 var itemType = search.lookupFields({
     //                     type: 'item',
     //                     id: item,
     //                     columns: ['type']
     //                 })

     //                 var quantityLine = thisRecord.getSublistValue({
     //                     sublistId: 'item',
     //                     fieldId: 'quantity',
     //                     line: i
     //                 });
     //                 var quantity = thisRecord.getSublistValue({
     //                     sublistId: 'item',
     //                     fieldId: 'custpage_sdb_qty_to_installed',
     //                     line: i
     //                 });
     //                 var qtyInstalled = thisRecord.getSublistValue({
     //                     sublistId: 'item',
     //                     fieldId: 'custcol_sdb_installed_qty',
     //                     line: i
     //                 });

     //                 var fully_installed = thisRecord.getSublistValue({
     //                     sublistId: 'item',
     //                     fieldId: 'custcol_sdb_installed',
     //                     line: i,
     //                 });
     //                 var fully_installedOld = thisRecordOld.getSublistValue({
     //                     sublistId: 'item',
     //                     fieldId: 'custcol_sdb_installed',
     //                     line: i,
     //                 });
     //                 var intalationDate = thisRecord.getSublistValue({
     //                     sublistId: 'item',
     //                     fieldId: 'custcol_sdb_date_of_installation',
     //                     line: i,
     //                 });
     //                 //log.debug('fully_installed', fully_installed);
     //                 log.debug('quantity beforeSubmit', quantity);
     //                 // if ((itemType.type[0].value != 'InvtPart' || itemType.type[0].value == "OthCharge") && !quantity && fully_installed) continue;
     //                 if ((itemType.type[0].value != 'InvtPart' || itemType.type[0].value == "OthCharge") && fully_installedOld) continue;


     //                 if (quantityLine && fully_installed) {
     //                     // items.push({ item: item, qty: quantity });
     //                     if (!intalationDate) intalationDate = new Date();
     //                     var date = format.parse({
     //                         value: intalationDate,
     //                         type: format.Type.DATE
     //                     });
     //                     thisRecord.setSublistValue({
     //                         sublistId: 'item',
     //                         fieldId: 'custcol_sdb_date_of_installation',
     //                         line: i,
     //                         value: date
     //                     });
     //                     items.push({ item: item, qty: quantityLine, instalacionDate: date });

     //                     //var totalInstalled = 0;
     //                     // if (Number(qtyInstalled) > 0) {
     //                     //     totalInstalled = Number(quantity) + Number(qtyInstalled);
     //                     //     log.debug('totalInstalled 1', totalInstalled);
     //                     // } else {
     //                     //     totalInstalled += Number(quantity)
     //                     //     log.debug('totalInstalled 2', totalInstalled);
     //                     // }

     //                     // thisRecord.setSublistValue({
     //                     //     sublistId: 'item',
     //                     //     fieldId: 'custcol_sdb_installed_qty',
     //                     //     line: i,
     //                     //     value: totalInstalled
     //                     // });

     //                     // if (totalInstalled == Number(quantityLine)) {
     //                     //     log.debug('totalInstalled 3', totalInstalled);
     //                     //     thisRecord.setSublistValue({
     //                     //         sublistId: 'item',
     //                     //         fieldId: 'custcol_sdb_fully_installed',
     //                     //         line: i,
     //                     //         value: true
     //                     //     });
     //                     // }
     //                 }

     //             } catch (e) {
     //                 log.debug('afterSubmit error in for II', e);
     //             }
     //         }

     //         installInfo.items = items;
     //         log.debug('items count', items.length);
     //         if (installInfo.items.length > 0) createRecordInstalled(installInfo);

     //     } catch (e) {
     //         log.debug('afterSubmit error install info', e);
     //     }
     // }
     function createAdjustment(data) {
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
             if (data.items && data.items.length) {
                 for (var i = 0; i < data.items.length; i++) {
                     var thisItem = data.items[i];
                     log.debug('thisItem', thisItem);
                     log.debug('thisItem.lotNumbners.length', thisItem.lotNumbners.length);
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
                         value: isSerial ? thisItem.lotNumbners.length : thisItem.qty
                     });
                     if (isSerial) {
                         var subrecordInvDetail = adjutment.getCurrentSublistSubrecord({
                             sublistId: 'inventory',
                             fieldId: 'inventorydetail'
                         });
                         thisItem.lotNumbners.forEach(elem => {
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
             log.error('error createAdjustment', e);
         }
     }
     function createRecordInstalled(objData) {
         try {
             if (!objData) return false;

             if (objData.items && objData.items.length) {
                 var count = objData.items.length;
                 for (var x = 0; x < count; x++) {
                     var thisObj = objData.items[x];
                     var rcd = record.create({
                         type: 'customrecord_sdb_item_installed',
                         isDynamic: true,
                     })

                     rcd.setValue({
                         fieldId: 'custrecord_sdb_date',
                         value: new Date(),
                         ignoreFieldChange: true
                     })
                     rcd.setValue({
                         fieldId: 'custrecord_sdb_item_fulfillment',
                         value: objData.fulfill,
                         ignoreFieldChange: true
                     })
                     rcd.setValue({
                         fieldId: 'custrecord_sdb_item',
                         value: thisObj.item,
                         ignoreFieldChange: true
                     })
                     log.debug('thisObj', thisObj);
                     const isSerial = thisObj.itemType === 'serializedinventoryitem';
                     log.debug('isSerial', isSerial);
                     if (isSerial) {
                         rcd.setValue({
                             fieldId: 'custrecord_sdb_serial_num',
                             value: thisObj.lotNumbners,
                             ignoreFieldChange: true
                         })
                     }
                     rcd.setValue({
                         fieldId: 'custrecord_sdb_subsidiary',
                         value: objData.subsidiary,
                         ignoreFieldChange: true
                     })
                     rcd.setValue({
                         fieldId: 'custrecord_sdb_qty_installed',
                         value: isSerial ? 1 : thisObj.qty,
                         ignoreFieldChange: true
                     })

                     rcd.setValue({
                         fieldId: 'custrecord_sdb_location',
                         value: objData.locationIAC,
                         ignoreFieldChange: true
                     })

                     rcd.setValue({
                         fieldId: 'custrecord_sdb_account',
                         value: objData.accountId,
                         ignoreFieldChange: true
                     })

                     var custRec = rcd.save()
                     log.debug('custRec>>>', custRec);
                     var rcdNew = record.load({
                         type: 'customrecord_sdb_item_installed',
                         id: custRec,
                         isDynamic: true
                     })

                     rcdNew.setValue({
                         fieldId: 'custrecord_sdb_created',
                         value: true,
                         ignoreFieldChange: true
                     })

                     // if (custRec) CreateNegativeAdjustment(rcdNew);
                     //    var id= rcdNew.save();
                     //    log.debug('id', id);
                     // record.submitFields({
                     //     type: 'customrecord_sdb_item_installed',
                     //     id: custRec,
                     //     values: {
                     //         custrecord_sdb_created: true
                     //     }

                     // })
                 }
             }

         } catch (e) {
             log.debug('error createRecordInstalled', e);
         }
     }
     function CreateNegativeAdjustment(rec) {
         try {
             var thisRecord = rec;
             var scriptObj = runtime.getCurrentScript();
             var locationIAC = thisRecord.getValue('custrecord_sdb_location');
             var item = thisRecord.getValue('custrecord_sdb_item');
             var itemFulFill = thisRecord.getValue('custrecord_sdb_item_fulfillment');
             var quantity = thisRecord.getValue('custrecord_sdb_qty_installed');
             var accountId = scriptObj.getParameter({ name: 'custscript_sdb_account' });
             var subsidiary = thisRecord.getValue('custrecord_sdb_subsidiary')

             var adjutment = record.create({
                 type: record.Type.INVENTORY_ADJUSTMENT,
                 isDynamic: true
             });
             adjutment.setValue({ fieldId: 'custbody_sdb_ifulfill_req_install', value: itemFulFill, ignoreFieldChange: true })
             adjutment.setValue({ fieldId: 'custbody_sdb_item_installed_rcd', value: thisRecord.id, ignoreFieldChange: true })
             adjutment.setValue({ fieldId: 'subsidiary', value: subsidiary });
             adjutment.setValue({ fieldId: 'account', value: accountId });
             adjutment.selectNewLine({ sublistId: 'inventory' });
             adjutment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'item', value: item });
             adjutment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'location', value: locationIAC });
             adjutment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'adjustqtyby', value: Number(quantity) * -1 });

             var subrecord = adjutment.getCurrentSublistSubrecord({
                 sublistId: 'inventory',
                 fieldId: 'inventorydetail'
             });

             subrecord.selectNewLine({ sublistId: 'inventoryassignment' });
             subrecord.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: Number(quantity) * -1 });
             subrecord.setCurrentSublistText({ sublistId: 'inventoryassignment', fieldId: 'inventorynumber', value: 'PI005' });
             //   subrecord.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'inventorystatus', value: 1 });
             subrecord.commitLine({ sublistId: 'inventoryassignment' });
             subrecord.removeLine({ sublistId: 'inventoryassignment', line: 1 });
             adjutment.commitLine({ sublistId: 'inventory' });

             var recordId = adjutment.save({
                 ignoreMandatoryFields: true
             });

             log.debug('custom rec id', rec.save());
             log.debug('EXECUTE', 'Create adj. negative ' + recordId);


         } catch (e) {
             log.debug('afterSubmit create adjustent info', e);
         }
     }

     function updateSoLines(so_id, if_data) {
         // log.debug('if_data', if_data);
         if (so_id && if_data && if_data.length) {
             try {
                 var so = record.load({ type: record.Type.SALES_ORDER, id: so_id, isDynamic: true });
                 var count = so.getLineCount({
                     sublistId: 'item'
                 })
                 //  log.audit({ title: ' count >', details: count });

                 for (var x = 0; x < if_data.length; x++) {
                     var line = parseInt(if_data[x].line);
                     var date = parseInt(if_data[x].date);

                     if (count < line) continue;
                     so.selectLine({ sublistId: "item", line: line });

                     if (date) {
                         so.selectLine({ sublistId: 'item', line: line });
                         so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_date_of_installation', value: date });
                         so.commitLine({ sublistId: 'item' });
                     }
                 }
                 var id = so.save({
                     enableSourcing: true,
                     ignoreMandatoryFields: true
                 });

                 return id;
             } catch (error) {
                 log.error('Error updateSoLines', error);
             }
         }
     }
     return {
         beforeLoad: beforeLoad,
         afterSubmit: afterSubmit,
         // beforeSubmit: beforeSubmit
     };

 });


