/**
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 */
 define(['N/runtime', 'N/record', 'N/search', 'N/ui/dialog'], function (runtime, record, search, dialog) {

    function pageInit(context) {


    }

    function fieldChanged(context) {

        var rec = context.currentRecord;
       var status =rec.getValue('shipstatus')
        debugger;
      return true
        if (context.fieldId == 'shipstatus' && status != 'C') {
          
         // var myRecordFieldB = rec.getField({
          //  fieldId: 'custcol_sdb_date_of_installation'
       // });
        
       // myRecordFieldB.isDisabled = true;
           var sublistName = rec.getSublist({sublistId: "item"});
        var oranColumn = sublistName.getColumn({ fieldId: "custcol_sdb_installed" });
 oranColumn.isDisabled = true;
         //  var myRecordFieldA = rec.getField({
         //   fieldId: 'custcol_sdb_installed'
       // });
        
      //  myRecordFieldA.isDisabled = true;

        }else if(context.fieldId == 'shipstatus' && status == 'C'){
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

    

    return {
        fieldChanged: fieldChanged,
        pageInit: pageInit
    }
});
