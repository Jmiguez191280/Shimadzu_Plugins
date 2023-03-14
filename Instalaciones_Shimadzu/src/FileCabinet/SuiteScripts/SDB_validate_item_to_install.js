/**
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 */
 define(['N/runtime', 'N/record', 'N/search', 'N/ui/dialog', 'N/format'], function (runtime, record, search, dialog, format) {

  function pageInit(context) {
  }

  function fieldChanged(context) {

    var rec = context.currentRecord;
    var status = rec.getValue('shipstatus')
    var install_all = rec.getValue('custbody_sdb_install_all')
    var date_install = rec.getValue('custbody_sdb_installed_date')
    var comments = rec.getValue('custbody_sdb_message')
    debugger;

    if ((context.fieldId == 'custbody_sdb_installed_date' || context.fieldId == 'custbody_sdb_install_all') && status != 'C') {
      alert('Attention !!! .The transaction status must be "Shipped" in order to install.')
      rec.setValue({
        fieldId: 'custbody_sdb_installed_date',
        value: '',
        ignoreFieldChange: true
      })
      rec.setValue({
        fieldId: 'custbody_sdb_install_all',
        value: false,
        ignoreFieldChange: true
      })
    } else if (context.fieldId == 'custbody_sdb_installed_date' && status == 'C') {
      if (!install_all || install_all == 'F') {
        alert('Attention !!! .The checkbox install all must be checked.')
      } else if ((install_all || install_all == 'T') && date_install) {
        setInstaledColumns(rec, false, install_all, date_install)
      } else {
        alert('Attention !!! .The "INSTALLED DATE" field cannot be empty.')
        setInstaledColumns(rec, true, install_all, date_install)
      }
    } else if (context.fieldId == 'custbody_sdb_install_all') {
      if ((install_all || install_all == 'T') && date_install) setInstaledColumns(rec, false, install_all, date_install)
      if ((install_all || install_all == 'T') && !date_install) setInstaledColumns(rec, true, install_all, date_install)
      if (!install_all || install_all == 'F') setInstaledColumns(rec, true, install_all, date_install)
    }
    return true
    if (context.fieldId == 'shipstatus' && status != 'C') {
      // var myRecordFieldB = rec.getField({
      //  fieldId: 'custcol_sdb_date_of_installation'
      // });
      // myRecordFieldB.isDisabled = true;
      var sublistName = rec.getSublist({ sublistId: "item" });
      var oranColumn = sublistName.getColumn({ fieldId: "custcol_sdb_installed" });
      oranColumn.isDisabled = true;
      //  var myRecordFieldA = rec.getField({
      //   fieldId: 'custcol_sdb_installed'
      // });
      //  myRecordFieldA.isDisabled = true;
    } else if (context.fieldId == 'shipstatus' && status == 'C') {
      //   var myRecordFieldB = rec.getField({
      //   fieldId: 'custcol_sdb_date_of_installation'
      // });
      //  myRecordFieldB.isDisabled = false;
      //      var myRecordFieldA = rec.getField({
      //       fieldId: 'custcol_sdb_installed'
      //   });
      //    myRecordFieldA.isDisabled = false;
    }
  }

  function setInstaledColumns(thisRecord, remove, install_all, date_install) {

    debugger
    var installdate = thisRecord.getValue('custbody_sdb_installed_date')
    var lineCount = thisRecord.getLineCount({ sublistId: 'item' });
    log.debug('linecounts', lineCount);

    for (var i = 0; i < lineCount; i++) {
      try {
        thisRecord.selectLine({
          sublistId: 'item',
          line: i
        })

        var itemreceive = thisRecord.getCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'itemreceive',
          line: i
        });

        if (!itemreceive || itemreceive == 'F') continue;
        if (remove) {
          thisRecord.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_sdb_date_of_installation',
            value: ''
          });
          thisRecord.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_sdb_installed',
            value: false
          });

        } else {
          if (date_install) {
            var date = format.parse({
              value: new Date(date_install),
              type: format.Type.DATE,
            });
            thisRecord.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_sdb_date_of_installation',
              value: date
            });
          }
          thisRecord.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_sdb_installed',
            value: install_all
          });
        }
        thisRecord.commitLine({
          sublistId: 'item'
        });
      } catch (e) {
        log.debug('setInstaledColumns exception', e);
      }
    }
  }
  
  function validateInstall(thisRecord) {
    var custbody_sdb_report_number = thisRecord.getValue('custbody_sdb_report_number')
    var lineCount = thisRecord.getLineCount({ sublistId: 'item' });
    log.debug('linecounts', lineCount);

    for (var i = 0; i < lineCount; i++) {
      try {

        thisRecord.selectLine({
          sublistId: 'item',
          line: i
        })

        var itemreceive = thisRecord.getCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'itemreceive',
          line: i
        });
        var custcol_sdb_installed = thisRecord.getCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_sdb_installed',
          line: i
        });
        var custcol_sdb_date_of_installation = thisRecord.getCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_sdb_date_of_installation',
          line: i
        });
        if (custcol_sdb_date_of_installation && custcol_sdb_installed && itemreceive) {
          return true;
        }
      } catch (e) {
        log.debug('validateInstall exception', e);
      }
    }
    return false;
  }

  function saveRecord(context) {

    try {
      debugger
      var currentRecord = context.currentRecord;
      var install_all = currentRecord.getValue('custbody_sdb_install_all')
      var date_install = currentRecord.getValue('custbody_sdb_installed_date')
      var comments = currentRecord.getValue('custbody_sdb_report_number')
      var validate = validateInstall(currentRecord)
      if (install_all && date_install && !comments) {
        alert('Alert, the REPORT NUMBER field is required to confirm the installation ')
        return false;
      } else if (validate && !comments) {
        alert('Alert, the REPORT NUMBER field is required to confirm the partial installation ')
        return false;
      }
      return true;
    } catch (e) {
      log.debug('saveRecordsaveRecord', e);
    }
  }


  return {
    fieldChanged: fieldChanged,
    pageInit: pageInit,
    saveRecord: saveRecord
  }
});
