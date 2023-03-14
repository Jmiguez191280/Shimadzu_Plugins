/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript    
 */
 define(['N/ui/serverWidget', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/file', 'N/config', 'N/format', 'N/log', 'N/task'],

 function (serverWidget, record, runtime, search, task, file, config, format, log, task) {
     function beforeLoad(context) {
         try {
             var rec = context.newRecord;
             var status = rec.getValue('status');
             var form_1 = context.form;
             // var sublist = form_1.getSublist({
             //     id: 'item'
             // })
             log.debug('status', status);
             return
             if (status != 'Shipped') {
                 var itemFieldDate = form_1.getSublist({ id: 'item' })
                 itemFieldDate = itemFieldDate.getField({ id: 'custcol_sdb_date_of_installation' });
                 itemFieldDate.updateDisplayType({
                     displayType: serverWidget.FieldDisplayType.DISABLED
                 })

                 var itemFieldCheck = form_1.getSublist({ id: 'item' })
                 itemFieldCheck = itemFieldCheck.getField({ id: 'custcol_sdb_installed' });
                 itemFieldCheck.updateDisplayType({
                     displayType: serverWidget.FieldDisplayType.DISABLED
                 })
                 log.debug('itemFieldCheck', itemFieldCheck);
             }
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

     function beforeSubmit(context) {

         try {
             var rec = context.newRecord;
             var rcdId = rec.id;
             var createdFrom = rec.getValue('createdfrom')
             log.debug('context.type ', context.type);
             log.debug('rcdId ', rcdId);
             if (context.type == context.UserEventType.DELETE) {
                 //deleteAssociatesRecords Borra custom record asociados
                 var rcdDelete = deleteAssociatesRecords(rcdId)
                 if (!createdFrom) return;
                 //Deschequear en la SO Installed false
                 record.submitFields({
                     type: record.Type.SALES_ORDER,
                     id: createdFrom,
                     values: {
                         custbody_sdb_if_installed: false
                     },
                 })
                 //Deschequear en la Invoice Installed false
                 setInstalledFlag(createdFrom)
                 log.debug('rcdDelete =>', rcdDelete);
                 return;
             }
         } catch (e) {
             log.debug('beforeSubmit error', e);
         }
     }

     function afterSubmit(context) {
         var scriptObj = runtime.getCurrentScript();
         if (context.type == context.UserEventType.DELETE) return;
         var itemIntalled = [];
         var allInstall = context.newRecord.getValue('custbody_sdb_install_all');
         var dateInstalledBody = context.newRecord.getValue('custbody_sdb_installed_date');
         var reportNumber = context.newRecord.getValue('custbody_sdb_report_number');
         var comments = context.newRecord.getValue('custbody_sdb_message');
         log.debug('allInstall', allInstall);
         if (context.type == context.UserEventType.CREATE /*|| context.type == context.UserEventType.EDIT*/) {
             try {
                 var data = {};
                 var thisRecord = record.load({
                     type: record.Type.ITEM_FULFILLMENT,
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
                 var itemFilter = [];
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

                         //dpe no
                         var itemType = search.lookupFields({
                             type: 'item',
                             id: item,
                             columns: ['type', 'recordtype']
                         })

                         // log.audit('custpage_sdb_qty_to_installed---> ' + i, thisRecord.getSublistValue({
                         //     sublistId: 'item',
                         //     fieldId: 'custpage_sdb_qty_to_installed',
                         //     line: i
                         // }));
                         var installed = thisRecord.getCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'custcol_sdb_installed',

                         });
                         var installedDate = thisRecord.getCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'custcol_sdb_date_of_installation',

                         });
                         log.debug('itemType.type', itemType.type);
                         log.debug('itemType.recordtype==', itemType.recordtype);
                         if (itemType.type[0].value != 'InvtPart' || itemType.type[0].value == "OthCharge") continue;
                         var quantity = thisRecord.getCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'quantity',
                             line: i
                         });
                         itemFilter.push(item)
                         var irSubRecord = thisRecord.getCurrentSublistSubrecord({
                             sublistId: 'item',
                             fieldId: 'inventorydetail'
                         });
                         var irSubRecLineCount = irSubRecord.getLineCount('inventoryassignment');
                         var lotNumber = [];
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
                             //  log.debug('NUMBER', number)
                             lotNumber.push(number)
                             items.push({
                                 item: item,
                                 lotNumber: number,
                                 qty: qty,//lotNumber.length,
                                 itemType: itemType.recordtype,
                                 line: i,
                                 itemInstalled: installed,
                                 installedDate: installedDate,
                                 soId: createdFrom
                             })
                         }
                         itemsAdj.push({
                             item: item,
                             lotNumber: lotNumber,
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

                 log.debug('createAdjustment', 'on');
                 log.debug('objsReturn', objsReturn);
                 log.debug('installinfo', installInfo);

                 if (objsReturn.items) createAdjustment(objsReturn);
                 var created = false;
                 if (items.length > 0 && createdFrom) /*updateSoLines(createdFrom, itemIntalled);*/ {
                     created = createRecordInstalled(installInfo, itemFilter, reportNumber,);
                 }
                 //if (created) validateFullInstalled(context.newRecord.id, itemFilter);
             } catch (e) {
                 log.debug('afterSubmit create adjustent info', e);
             }
         } else if (context.type == context.UserEventType.EDIT || context.type == 'ship') {
             try {
                 var data = {};
                 var thisRecord = record.load({
                     type: record.Type.ITEM_FULFILLMENT,
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
                 var objs = {};
                 var objsRemove = {};
                 log.debug('soData', soData);
                 log.debug('context.type edit', context.type);
                 if ((soData.custbody_sdb_requires_installation || soData.custbody_sdb_requires_installation == 'T') && /*oldStatus != 'Shipped' &&*/ (context.type == 'ship' || status == 'Shipped')) {
                     var lineCount = thisRecord.getLineCount({ sublistId: 'item' });
                     //installInfo for custom record
                     var installInfo = {};
                     installInfo.fulfill = thisRecord.id;
                     installInfo.locationIAC = locationIAC;
                     installInfo.accountId = account;
                     installInfo.subsidiary = soData.subsidiary[0].value;

                     var items = []
                     var itemsIds = [];
                     var itemsIdsRemoveInstal = [];
                     for (var i = 0; i < lineCount; i++) {

                         try {

                             thisRecord.selectLine({
                                 sublistId: 'item',
                                 line: i
                             });
                             var item = thisRecord.getCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'item',

                             });
                             log.debug('item', item);
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

                             var installed = thisRecord.getCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'custcol_sdb_installed',

                             });
                             var installedDate = thisRecord.getCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'custcol_sdb_date_of_installation',

                             });
                             var oldinstalled = thisRecordOld.getSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'custcol_sdb_installed',
                                 line: i,
                             });

                             log.debug('installedDate', installedDate);
                             log.debug('oldinstalled', oldinstalled);
                             log.debug('installed', installed);

                             //  if ((!oldinstalled || oldinstalled ! 'F') && (installed || installed == 'T')) {
                             if ((!oldinstalled || oldinstalled == 'F') && (installed || installed == 'T')) {

                                 log.debug('old=F,inst=T', thisRecord);

                                 itemsIds.push(item)
                                 objs[item + '_' + i] = { date: installedDate, line: i };

                                 // } else if ((oldinstalled || oldinstalled != 'T') && (!installed || installed == 'F')) {
                             } else if ((oldinstalled || oldinstalled == 'T') && (!installed || installed == 'F')) {

                                 log.debug('old=T,inst=F', thisRecord);
                                 itemsIdsRemoveInstal.push(item)
                                 objsRemove[item + '_' + i] = { line: i };
                                 var installedDate = thisRecord.setCurrentSublistValue({
                                     sublistId: 'item',
                                     fieldId: 'custcol_sdb_date_of_installation',
                                     value: null
                                 });

                             }

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

                             log.debug('itemType.type', itemType.type[0].value);
                             log.debug('itemType.type=', itemType.recordType)
                             //dpe
                             log.debug('itemType.recordtype', itemType.recordtype);

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

                                 //dpe
                                 items.push({
                                     item: item,
                                     lotNumber: number,
                                     qty: qty,
                                     itemType: itemType.recordtype,
                                     line: i,
                                     itemInstalled: installed,
                                     installedDate: installedDate,
                                     soId: createdFrom
                                 })
                             }

                         } catch (e) {
                             log.debug('afterSubmit error in for I', e);
                         }
                     }

                     installInfo.items = items;
                     installInfo.saleOrder = createdFrom;

                     log.debug('installInfo', installInfo);
                     log.debug('itemsIds.length', itemsIds.length);
                     if (items.length > 0 && createdFrom && oldStatus != 'Shipped')/*updateSoLines(createdFrom, itemIntalled);*/ createRecordInstalled(installInfo, null, reportNumber, comments);
                     if (itemsIds.length) setInstalled(itemsIds, thisRecord.id, objs, false, reportNumber);
                     if (itemsIdsRemoveInstal.length) setInstalled(itemsIdsRemoveInstal, thisRecord.id, objsRemove, true, reportNumber, comments);
                 }
             } catch (e) {
                 log.debug('afterSubmit error install info', e);
             }
         }
     }

     function setInstalled(item, itemF, objs, flag, reportNumber, comments) {
         try {
             log.debug('ON setInstalled', objs);
             log.debug('ON setInstalled item', item);
             log.debug('ON setInstalled flag', flag);
             if (flag) {
                 var obj = { itemsIds: item, itemF: itemF, objs: objs, reportNumber: reportNumber, comments: comments }

                 var scheduledScript = task.create({
                     taskType: task.TaskType.SCHEDULED_SCRIPT
                 });
                 scheduledScript.scriptId = 'customscript_sdb_set_custom_rec';
                 scheduledScript.deploymentId = null;
                 scheduledScript.params = {
                     'custscript_ss_data_remove': obj,
                     'custscript_ss_data': '',
                     'custscript_ss_rcdid': ''
                 };

                 log.debug('task id1', scheduledScript.submit())
             } else if (!flag) {
                 var obj = { itemsIds: item, itemF: itemF, objs: objs, reportNumber: reportNumber, comments: comments }

                 var scheduledScript = task.create({
                     taskType: task.TaskType.SCHEDULED_SCRIPT
                 });
                 scheduledScript.scriptId = 'customscript_sdb_set_custom_rec';
                 scheduledScript.deploymentId = null;
                 scheduledScript.params = {
                     'custscript_ss_data_remove': '',
                     'custscript_ss_data': obj,
                     'custscript_ss_rcdid': ''
                 };
                 log.debug('task id2', scheduledScript.submit())
             }
             return;
         } catch (e) {
             log.debug('setInstalled Error', e);
         }
     }

     function setInstalledFlag(id) {

         try {
             var invoiceSearchObj = search.create({
                 type: "invoice",
                 filters:
                     [
                         ["type", "anyof", "CustInvc"],
                         "AND",
                         ["createdfrom", "anyof", id],
                         "AND",
                         ["mainline", "is", "T"]
                     ],
                 columns: []
             });
             var searchResultCount = invoiceSearchObj.runPaged().count;
             log.debug("invoiceSearchObj result count", searchResultCount);
             invoiceSearchObj.run().each(function (result) {
                 record.submitFields({
                     type: record.Type.INVOICE,
                     id: result.id,
                     values: {
                         custbody_sdb_if_installed: false
                     },
                 })
                 return true;
             });

         } catch (e) {
             log.error('setInstalledFlag', e)
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
                 log.debug('result.getValue(custrecord_sdb_installed_rec)', result.getValue('custrecord_sdb_installed_rec'));
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
                     columns: ['createdfrom']
                 })
                 var inv = getInvoice(itemFilter, createdFrom.createdfrom[0].value);

                 record.submitFields({
                     type: record.Type.INVOICE,
                     id: inv,
                     values: {
                         custbody_sdb_if_installed: true,
                         custbody_sdb__service_report_number: id
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
             log.error('error createAdjustment', e);
         }
     }

     function createRecordInstalled(objData, items, reportNumber, comments) {
         try {

             if (!objData) return false;
             log.debug('objData', objData);
             log.debug('reportNumber', reportNumber);
             var serialitems = objData.items.filter((el) => el.itemType == 'serializedinventoryitem');
             var inventItems = objData.items.filter((el) => el.itemType != 'serializedinventoryitem');
             log.error('serialitems', serialitems);
             log.error('inventItems', inventItems);
             if (serialitems && serialitems.length) {// Crea los record individuales para que se pueda usar mejor para las instalaciones parciales y manejar las qtys

                 // log.debug('items', objData.items);
                 var count = serialitems.length;
                 for (var x = 0; x < count; x++) {
                     var thisObj = serialitems[x];
                     // log.debug('instaled', objData.items[x].itemInstalled)
                     // log.debug('installed', thisObj.itemInstalled)
                     var rcd = record.create({
                         type: 'customrecord_sdb_item_installed_rec',
                         isDynamic: true,
                     })
                     rcd.setValue({
                         fieldId: 'custrecord_sdb_date_rec',
                         value: new Date(),
                         ignoreFieldChange: true
                     })

                     rcd.setValue({
                         fieldId: 'custrecord_sdb_report_number',
                         value: reportNumber,
                         ignoreFieldChange: true
                     })
                     rcd.setValue({
                         fieldId: 'custrecord_sdb_comments',
                         value: comments || '',
                     })

                     rcd.setValue({
                         fieldId: 'custrecord_sdb_item_fulfillment_rec',
                         value: objData.fulfill,
                         ignoreFieldChange: true
                     })

                     rcd.setValue({
                         fieldId: 'custrecord_sdb_line_number_rec',
                         value: thisObj.line,
                         ignoreFieldChange: true
                     })

                     rcd.setValue({
                         fieldId: 'custrecord_sdb_sales_order_rec',
                         value: objData.saleOrder,
                         ignoreFieldChange: true
                     })
                     rcd.setValue({
                         fieldId: 'custrecord_sdb_item_rec',
                         value: thisObj.item,
                         ignoreFieldChange: true
                     })
                     log.debug('thisObj', thisObj);
                     // log.debug('thisObj.itemInstalled', thisObj.itemInstalled);

                     log.debug('item', thisObj.item);
                     var itemType = search.lookupFields({
                         type: 'item',
                         id: thisObj.item,
                         columns: ['type', 'recordtype']
                     })

                     // const isSerial = thisObj.itemType === 'serializedinventoryitem';
                     const isSerial = itemType.recordtype == 'serializedinventoryitem' || thisObj.itemType == 'serializedinventoryitem';
                     log.debug('isSerial', isSerial);
                     if (isSerial) {
                         rcd.setValue({
                             fieldId: 'custrecord_sdb_serial_num_rec',
                             value: thisObj.lotNumber,
                             ignoreFieldChange: true
                         })
                     }
                     rcd.setValue({
                         fieldId: 'custrecord_sdb_subsidiary_rec',
                         value: objData.subsidiary,
                         ignoreFieldChange: true
                     })
                     rcd.setValue({
                         fieldId: 'custrecord_sdb_qty_installed_rec',
                         value: 1,
                         ignoreFieldChange: true
                     })

                     rcd.setValue({
                         fieldId: 'custrecord_sdb_location_rec',
                         value: objData.locationIAC,
                         ignoreFieldChange: true
                     })

                     rcd.setValue({
                         fieldId: 'custrecord_sdb_account_rec',
                         value: objData.accountId,
                         ignoreFieldChange: true
                     })
                     // itemInstalled:installed,
                     // installedDate:installedDate,
                     // soId:createdFrom
                     //  log.debug('objData.itemInstalled', objData.itemInstalled);
                     //  log.debug('thisObj.itemInstalled',thisObj.itemInstalled);
                     //  if (objData.itemInstalled && objData.itemInstalled == 'T') {
                     // if (thisObj.itemInstalled && thisObj.itemInstalled == true || objData.itemInstalled && objData.itemInstalled == 'T'){

                     var installedFlag = false;
                     if (thisObj.itemInstalled && thisObj.itemInstalled == true /*|| objData.items[x].itemInstalled && objData.items[x].itemInstalled == true*/) {
                         installedFlag = true;
                         log.audit('installed settings serial', 'on')

                         // rcd.setValue({
                         //     fieldId: 'custrecord_sdb_installed_rec',
                         //     value: true
                         // }

                         if (!thisObj.installedDate || thisObj.installedDate == null) {
                             log.debug('objData.installedDate1', thisObj.installedDate)
                             rcd.setValue({
                                 fieldId: 'custrecord_sdb_instaltion_date_rec',
                                 value: new Date(),
                                 ignoreFieldChange: true
                             })

                         } else {
                             log.debug('objData.installedDate2', objData.installedDate)

                             var newdate = new Date(thisObj.installedDate)
                             var date = format.parse({
                                 value: newdate,
                                 type: format.Type.DATE,
                             });
                             log.debug('date', date);

                             rcd.setValue({
                                 fieldId: 'custrecord_sdb_instaltion_date_rec',
                                 value: date,
                                 ignoreFieldChange: true
                             })
                         }
                         rcd.setValue({
                             fieldId: 'custrecord_sdb_sales_order_rec',
                             value: thisObj.soId,
                             ignoreFieldChange: true
                         })
                     }
                     var custRec = rcd.save()
                     log.debug('custRec Serial', custRec);
                     if (installedFlag && custRec) {
                         var scheduledScript = task.create({
                             taskType: task.TaskType.SCHEDULED_SCRIPT
                         });
                         scheduledScript.scriptId = 'customscript_sdb_set_cus_rec_instalacion';
                         scheduledScript.deploymentId = null;
                         scheduledScript.params = {
                             'custscript_ss_rcdid': custRec,
                             'custscript_ss_items': items
                         };

                         log.debug('item', items);
                         log.audit('task set cust rec serial', scheduledScript.submit())

                     }

                 }
             }

             if (inventItems && inventItems.length) {// Crea los record individuales para que se pueda usar mejor para las instalaciones parciales y manejar las qtys

                 for (var t = 0; t < inventItems.length; t++) {
                     var count = Number(inventItems[t].qty);
                     var thisObj = inventItems[t];
                     log.error('inventItems[t]', inventItems[t]);
                     log.error('count inventItems', count);
                     for (var i = 0; i < count; i++) {
                         // log.debug('instaled', objData.items[x].itemInstalled)
                         // log.debug('installed', thisObj.itemInstalled)
                         var rcd = record.create({
                             type: 'customrecord_sdb_item_installed_rec',
                             isDynamic: true,
                         })
                         rcd.setValue({
                             fieldId: 'custrecord_sdb_date_rec',
                             value: new Date(),
                             ignoreFieldChange: true
                         })

                         rcd.setValue({
                             fieldId: 'custrecord_sdb_sales_order_rec',
                             value: objData.saleOrder,
                             ignoreFieldChange: true
                         })

                         rcd.setValue({
                             fieldId: 'custrecord_sdb_report_number',
                             value: reportNumber,
                             ignoreFieldChange: true
                         })
                         rcd.setValue({
                             fieldId: 'custrecord_sdb_comments',
                             value: comments || '',
                         })
                         rcd.setValue({
                             fieldId: 'custrecord_sdb_item_fulfillment_rec',
                             value: objData.fulfill,
                             ignoreFieldChange: true
                         })

                         rcd.setValue({
                             fieldId: 'custrecord_sdb_line_number_rec',
                             value: thisObj.line,
                             ignoreFieldChange: true
                         })

                         rcd.setValue({
                             fieldId: 'custrecord_sdb_item_rec',
                             value: thisObj.item,
                             ignoreFieldChange: true
                         })
                         log.debug('thisObj', thisObj);
                         log.debug('thisObj.itemInstalled', thisObj.itemInstalled);
                         //dpe/////////////////////////////////////////////////////////
                         log.debug('item', thisObj.item);
                         var itemType = search.lookupFields({
                             type: 'item',
                             id: thisObj.item,
                             columns: ['type', 'recordtype']
                         })
                         log.debug('itemType.type', itemType.type);
                         log.debug('itemType.recordtype', itemType.recordtype)

                         rcd.setValue({
                             fieldId: 'custrecord_sdb_subsidiary_rec',
                             value: objData.subsidiary,
                             ignoreFieldChange: true
                         })
                         rcd.setValue({
                             fieldId: 'custrecord_sdb_qty_installed_rec',
                             value: 1,
                             ignoreFieldChange: true
                         })

                         rcd.setValue({
                             fieldId: 'custrecord_sdb_location_rec',
                             value: objData.locationIAC,
                             ignoreFieldChange: true
                         })

                         rcd.setValue({
                             fieldId: 'custrecord_sdb_account_rec',
                             value: objData.accountId,
                             ignoreFieldChange: true
                         })
                         // itemInstalled:installed,
                         // installedDate:installedDate,
                         // soId:createdFrom
                         //  log.debug('objData.itemInstalled', objData.itemInstalled);
                         //  log.debug('thisObj.itemInstalled',thisObj.itemInstalled);
                         //  if (objData.itemInstalled && objData.itemInstalled == 'T') {
                         // if (thisObj.itemInstalled && thisObj.itemInstalled == true || objData.itemInstalled && objData.itemInstalled == 'T'){

                         var installedFlag = false;
                         if (thisObj.itemInstalled && thisObj.itemInstalled == true /*|| objData.items[x].itemInstalled && objData.items[x].itemInstalled == true*/) {
                             installedFlag = true;
                             log.audit('installed settings invent', 'on')

                             // rcd.setValue({
                             //     fieldId: 'custrecord_sdb_installed_rec',
                             //     value: true
                             // })
                             //dpe
                             if (!thisObj.installedDate || thisObj.installedDate == null) {
                                 log.debug('objData.installedDate1', thisObj.installedDate)
                                 rcd.setValue({
                                     fieldId: 'custrecord_sdb_instaltion_date_rec',
                                     value: new Date(),
                                     ignoreFieldChange: true
                                 })

                             } else {
                                 log.debug('objData.installedDate2', objData.installedDate)

                                 var newdate = new Date(thisObj.installedDate)
                                 var date = format.parse({
                                     value: newdate,
                                     type: format.Type.DATE,
                                 });
                                 log.debug('date', date);

                                 rcd.setValue({
                                     fieldId: 'custrecord_sdb_instaltion_date_rec',
                                     value: date,
                                     ignoreFieldChange: true
                                 })
                             }

                             rcd.setValue({
                                 fieldId: 'custrecord_sdb_sales_order_rec',
                                 value: thisObj.soId,
                                 ignoreFieldChange: true
                             })
                         }
                         var custRec = rcd.save()
                         log.debug('custRec Inventory', custRec);
                         if (installedFlag && custRec) {
                             var scheduledScript = task.create({
                                 taskType: task.TaskType.SCHEDULED_SCRIPT
                             });
                             scheduledScript.scriptId = 'customscript_sdb_set_cus_rec_instalacion';
                             scheduledScript.deploymentId = null;
                             scheduledScript.params = {
                                 'custscript_ss_rcdid': custRec,
                                 'custscript_ss_items': items
                             };

                             log.debug('item', items);

                             log.audit('task set cust rec inventario', scheduledScript.submit())
                         }
                     }
                 }
             }
             return true
         } catch (e) {
             if (custRec) {
                 record.submitFields({
                     type: 'customrecord_sdb_item_installed_rec',
                     id: custRec,
                     values: {
                         custrecord_sdb_ir_errormessage: e
                     }

                 })
             }
             log.debug('error createRecordInstalled', e);
         }
     }

     function deleteAssociatesRecords(rcdId) {
         try {
             //Borra Adjustment asociados
             var inventoryadjustmentSearchObj = search.create({
                 type: "inventoryadjustment",
                 filters:
                     [
                         ["custbody_sdb_ifulfill_req_install", "anyof", rcdId],
                         "AND",
                         ["type", "anyof", "InvAdjst"],
                         "AND",
                         ["mainline", "is", "T"]
                     ],
                 columns: []
             });
             var searchResultCount = inventoryadjustmentSearchObj.runPaged().count;
             log.debug("inventoryadjustmentSearchObj result count", searchResultCount);
             inventoryadjustmentSearchObj.run().each(function (result) {
                 record.delete({
                     type: record.Type.INVENTORY_ADJUSTMENT,
                     id: result.id
                 })
                 return true;
             });

             //Borra Custom record de instalacion asociados
             var customrecord_sdb_item_installedSearchObj = search.create({
                 type: "customrecord_sdb_item_installed_rec",
                 filters:
                     [
                         ["custrecord_sdb_item_fulfillment_rec", "anyof", rcdId]
                     ],
                 columns: []
             });
             var searchResultCount = customrecord_sdb_item_installedSearchObj.runPaged().count;
             log.debug("customrecord_sdb_item_installedSearchObj result count", searchResultCount);
             customrecord_sdb_item_installedSearchObj.run().each(function (result) {
                 record.delete({
                     type: 'customrecord_sdb_item_installed_rec',
                     id: result.id
                 })
                 return true;
             });

         } catch (e) {
             log.debug('deleteAssociatesRecords ERROR', e);
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
         beforeLoad: beforeLoad,
         afterSubmit: afterSubmit,
         beforeSubmit: beforeSubmit
     };

 });


