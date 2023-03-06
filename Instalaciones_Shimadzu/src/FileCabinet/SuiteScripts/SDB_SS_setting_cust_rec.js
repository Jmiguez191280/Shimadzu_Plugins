/**
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript       
 */

 define(['N/record', 'N/runtime', 'N/search', 'N/format'],
 function (record, runtime, search, format) {
     function execute(context) {
         try {
             // var asemblyId = runtime.getCurrentScript().getParameter('custscript_assemblyid');
             var data = runtime.getCurrentScript().getParameter('custscript_ss_data');
             var dataDelete = runtime.getCurrentScript().getParameter('custscript_ss_data_remove');
             var rcdid = runtime.getCurrentScript().getParameter('custscript_ss_rcdid');
             log.debug("rcdid", rcdid);
             if (rcdid) {

                 var rcdNew = record.load({
                     type: 'customrecord_sdb_item_installed_rec',
                     id: rcdid,
                     isDynamic: true
                 })
                 rcdNew.setValue({
                     fieldId: 'custrecord_sdb_installed_rec',
                     value: true,
                     ignoreFieldChange: true
                 })
                 var id = rcdNew.save();

                 log.debug('id', id);
                 return;
             }

             log.debug("data", data);
             if (data) data = JSON.parse(data);
             if (dataDelete) data = JSON.parse(dataDelete);
             if (!data.itemF) return
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
                     search.createColumn({ name: "custrecord_sdb_item_rec", label: "Item" })
                 ]
             });
             var searchResultCount = customrecord_sdb_item_installedSearchObj.runPaged().count;
             log.debug("customrecord_sdb_item_installedSearchObj result count", searchResultCount);

             log.debug('customrecord_sdb_item_installedSearchObj', customrecord_sdb_item_installedSearchObj);

             customrecord_sdb_item_installedSearchObj.run().each(function (result) {
                 var obj = data.objs[result.getValue('custrecord_sdb_item_rec') + '_' + result.getValue('custrecord_sdb_line_number_rec')];
                 log.debug("result.getValue('custrecord_sdb_item_rec'", result.getValue('custrecord_sdb_item_rec'));
                 log.debug("result.getValue('custrecord_sdb_line_number_rec'", result.getValue('custrecord_sdb_line_number_rec'));

                 // var newdate = new Date(obj.date);    
                 // log.debug('obj.date',obj.date);      empty
                 if (dataDelete) {
                     record.delete({
                         type: 'customrecord_sdb_item_installed_rec',
                         id: result.id
                     })
                 } else if (data) {
                     var rec = record.load({
                         type: 'customrecord_sdb_item_installed_rec',
                         id: result.id,
                         isDynamic: true,
                     })

                     if (obj.date) {
                         var date = format.parse({
                             value: new Date(obj.date),
                             type: format.Type.DATE,
                         });

                         log.debug("if obj.date", date);
                         rec.setValue({
                             fieldId: 'custrecord_sdb_instaltion_date_rec',
                             value: date,
                         })
                     } else {
                         var date = new Date();
                         log.debug("else obj.date", date);

                         var formateddate = format.parse({
                             value: date,
                             type: format.Type.DATE,
                         });

                         rec.setValue({
                             fieldId: 'custrecord_sdb_instaltion_date_rec',
                             value: formateddate,
                         })
                     }
                     rec.setValue({
                         fieldId: 'custrecord_sdb_installed_rec',
                         value: true,
                     })
                     log.debug(' rec.save();',
                         rec.save({
                             enableSourcing: true,
                             ignoreMandatoryFields: true
                         }));
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
             var itemF = search.lookupFields({
                 type: record.Type.ITEM_FULFILLMENT,
                 id: data.itemF,
                 columns: ['createdfrom', 'internalid', 'custbody_sdb_if_installed']
             })
             if (!itemF.custbody_sdb_if_installed) validateFullInstalled(itemF, data.itemsIds);
         } catch (e) {
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
                         ["custrecord_sdb_item_fulfillment_rec", "anyof", id.internalid]
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
                     id: id.internalid,
                     values: {
                         custbody_sdb_if_installed: true
                     }

                 })

                 var inv = getInvoice(itemFilter, id.createdfrom[0].value);
                 if (inv) {
                     record.submitFields({
                         type: record.Type.INVOICE,
                         id: inv,
                         values: {
                             custbody_sdb_if_installed: true
                         }

                     })
                 }
                 record.submitFields({
                     type: record.Type.SALES_ORDER,
                     id: id.createdfrom[0].value,
                     values: {
                         custbody_sdb_if_installed: true
                     }

                 })
             }
         } catch (e) {
             log.error('error validateInstaledCount', e);
         }
     }

     return {
         execute: execute
     };
 });
