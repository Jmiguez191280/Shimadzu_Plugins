/**
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 */
 define(['N/runtime', 'N/record', 'N/search', 'N/ui/dialog'], function (runtime, record, search, dialog) {

    function pageInit(context) {


    }

    function fieldChanged(context) {

        var rec = context.currentRecord;


        var scriptObj = runtime.getCurrentScript();
        debugger;
        if (context.sublistId == 'item' && context.fieldId == 'custpage_sdb_qty_to_installed') {

            var item = rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });
            var qty = rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity' });
            var qtyToInstall = rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'custpage_sdb_qty_to_installed' });
            var installed_qty = rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_installed_qty' });
            var fully_installed = rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_fully_installed' });
            var delta=Number(qty) - Number(installed_qty);
            // var qtyOnRecords = getrecorInstall(rec.id, item);
            if (fully_installed) {
                var options = {
                    title: "Attention!",
                    message: 'The installation for this item is now complete!!!',
                };
                dialog.alert(options);
                rec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custpage_sdb_qty_to_installed', value: '', ignoreFieldChange: true });
                return;
            } else if (Number(qtyToInstall) > Number(qty) || Number(qtyToInstall) < 0) {
                var options = {
                    title: "Attention!",
                    message: 'The "quantity to install" selected cannot exceed the quantity on the line or less than 0',
                };
                dialog.alert(options);
                rec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custpage_sdb_qty_to_installed', value: '', ignoreFieldChange: true });
                return;
            } else if (installed_qty && delta > Number(qtyToInstall)) {
                var options = {
                    title: "Attention!",
                    message: 'The quantity entered to install is greater than the quantity remaining to install, check and re-enter the value',
                };
                dialog.alert(options);
                rec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custpage_sdb_qty_to_installed', value: '', ignoreFieldChange: true });
                return;
            }

        }

    }

    function getrecorInstall(fulfill, item) {
        try {
            var customrecord_sdb_item_installedSearchObj = search.create({
                type: "customrecord_sdb_item_installed",
                filters:
                    [
                        ["custrecord_sdb_item_fulfillment", "anyof", fulfill],
                        "AND",
                        ["custrecord_sdb_item", "anyof", item],
                        "AND",
                        ["isinactive", "is", "F"]
                    ],
                columns:
                    [
                        search.createColumn({ name: "custrecord_sdb_date", label: "Date" }),
                        search.createColumn({ name: "custrecord_sdb_item_fulfillment", label: "Item Fulfillment" }),
                        search.createColumn({ name: "custrecord_sdb_item", label: "Item" }),
                        search.createColumn({ name: "custrecord_sdb_qty_installed", label: "Quantity installed" })
                    ]
            });
            var searchResultCount = customrecord_sdb_item_installedSearchObj.runPaged().count;
            log.debug("customrecord_sdb_item_installedSearchObj result count", searchResultCount);
            if (searchResultCount == 0) return false;
            var qtyInstalled = 0;
            customrecord_sdb_item_installedSearchObj.run().each(function (result) {
                var qty = result.getValue('custrecord_sdb_qty_installed');
                if (qty) qtyInstalled += qty;
                return true;
            });

        } catch (e) {
            log.debug('ERROR getrecorInstall', e);
        }
        return qtyInstalled
    }

    return {
        fieldChanged: fieldChanged,
        pageInit: pageInit
    }
});
