(function () {

    var protocol = location.protocol;
    var myConnector = tableau.makeConnector();

    var parms = {}

    const names = ["q1","q2","value"]

    myConnector.getSchema = function (schemaCallback) {

        var data_cols = [
            { id: "date", dataType: tableau.dataTypeEnum.date },
            { id: "hscode", dataType: tableau.dataTypeEnum.string },
            { id: "area", dataType: tableau.dataTypeEnum.string },
            { id: "area_name", dataType: tableau.dataTypeEnum.string },
            { id: "q1", dataType: tableau.dataTypeEnum.int },
            { id: "q2", dataType: tableau.dataTypeEnum.int },
            { id: "value", dataType: tableau.dataTypeEnum.int },
            { id: "unit1", dataType: tableau.dataTypeEnum.string },
            { id: "unit2", dataType: tableau.dataTypeEnum.string },
            { id: "unit_value", dataType: tableau.dataTypeEnum.string }
        ];
      
        var data_schema = {
                id: "data",
                alias: "品別国別表",
                columns: data_cols
        };
      

        // var meta_cols = [
        //     { id: "date", dataType: tableau.dataTypeEnum.string },
        //     { id: "hscode", dataType: tableau.dataTypeEnum.string }
        // ];
      
        // var meta_schema = {
        //         id: "meta",
        //         alias: "品別国別表",
        //         columns: cols
        // };


        schemaCallback([data_schema]);  
    };
  

    function convertName(code){
        return names[(code / 10 - 15) % 3]
    }
    function convertMonth(code){
        return Math.floor((code / 10 - 15) / 3) + 1
    };

    function argsToParms(args){

        var cdCat02 = ["100","110"]
        for(var i = 150; i <= 500;i+=10){
            cdCat02.push(String(i))    
        }

        var cdTimeFrom = args.year.split("-")[0].trim() + "000000"
        var cdTimeTo = args.year.split("-")[1].trim() + "000000"

        var parms = {
            appId: args.appId,
            statsDataId: "",
            metaGetFlg: "N",
            cdCat02: cdCat02.join(","),
            cdTimeFrom: cdTimeFrom,
            cdTimeTo: cdTimeTo,
            startPosition: ""
        }

        if (args.hscode != ""){
            parms["cdCat01"] = args.hscode
        }
        if (args.area != ""){
            parms["cdArea"] = args.area
        }

        return parms
    }


    function toSurveyYear(y){

        var surveyYear = y
        var y1 = y.slice(-1)
        switch (y1){
            case "1":
            case "2":
            case "3":
            case "4":
                surveyYear = y.slice(0,3) + "5"
                break
            case "6":
            case "7":
            case "8":
            case "9":
                surveyYear = String(parseInt(y.slice(0,3) + "9") + 1)
                break
            default:
        }

        return surveyYear

    }

    function getStatsDataIds(args){

        var ids = []
        var url = protocol + "//api.e-stat.go.jp/rest/3.0/app/json/getStatsList"
        var next_key = "1"
        
        var surveyYearFrom = toSurveyYear(args.year.split("-")[0].trim()) + "01"
        var surveyYearTo = toSurveyYear(args.year.split("-")[1].trim()) + "12"

        var parms = {
            appId: args.appId,
            statsCode: "00350300",
            searchWord: "品別国別表",
            surveyYears: surveyYearFrom + "-" + surveyYearTo,
            startPosition: ""
        }

        do {
            parms["startPosition"] = next_key
            $.ajax({
                url: url,
                type: 'GET',
                async: false,
                data: parms
                })
                .done(function(resp) {
                    
                    var tables = resp.GET_STATS_LIST.DATALIST_INF.TABLE_INF;
                    var result = resp.GET_STATS_LIST.DATALIST_INF.RESULT_INF;
                    next_key = "NEXT_KEY" in result ? result["NEXT_KEY"] : ""

                    _.forEach(tables, function(table) {

                        var id = table["@id"]
                        var tablename = table.STATISTICS_NAME_SPEC.TABULATION_SUB_CATEGORY1

                        if (tablename == "品別国別表"){ ids.push(id)}

                    });

                }).fail(function(jqXHR, textStatus, errorThrown) {

                    alert('ファイルの取得に失敗しました。');
                    console.log("ajax通信に失敗しました");
                    console.log("jqXHR          : " + jqXHR.status); // HTTPステータスが取得
                    console.log("textStatus     : " + textStatus);    // タイムアウト、パースエラー
                    console.log("errorThrown    : " + errorThrown.message); // 例外情報
                    console.log("URL            : " + url);
                    next_key = ""
                });
            
        } while (next_key != "")

        return ids

    };

    function getAreaNames(appId,statsDataId){


        var names = {}
        var url = protocol + "//api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo"
        parms = {
            "appId":appId,
            "statsDataId":statsDataId,
            "explanationGetFlg":"N"
        }        

        $.ajax({
            url: url,
            type: 'GET',
            async: false,
            data: parms
        }).done(function(resp) {
                
            var values = resp.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ;

            _.forEach(values, function(value) {

                if(value["@id"] == "area"){

                    _.forEach(value.CLASS, function(c) {
                        names[c["@code"]] = c["@name"].split("_")
                    })
                }
            })

        }).fail(function(jqXHR, textStatus, errorThrown){

            alert('ファイルの取得に失敗しました。');
            console.log("ajax通信に失敗しました");
            console.log("jqXHR          : " + jqXHR.status); // HTTPステータスが取得
            console.log("textStatus     : " + textStatus);    // タイムアウト、パースエラー
            console.log("errorThrown    : " + errorThrown.message); // 例外情報
            console.log("URL            : " + url);
            next_key = ""
        });


        return names

    };

    function getStatsData(parms,statsDataId){

        var url = protocol + "//api.e-stat.go.jp/rest/3.0/app/json/getStatsData"
        var tableData = []
        var unit1 = {}
        var unit2 = {}
        var datas = {}
        var next_key = "1"
        parms["statsDataId"] = statsDataId

        // 国名マスターの取得
        var areanames = getAreaNames(parms["appId"],statsDataId)

        do {
            parms["startPosition"] = next_key
            $.ajax({
                url: url,
                type: 'GET',
                async: false,
                data: parms
                })
                .done(function(resp) {
                    
                    var result = resp.GET_STATS_DATA.STATISTICAL_DATA.RESULT_INF
                    next_key = "NEXT_KEY" in result ? result["NEXT_KEY"] : ""
                    total = result.TOTAL_NUMBER;

                    if (total >= 1){

                        var values = resp.GET_STATS_DATA.STATISTICAL_DATA.DATA_INF.VALUE;

                        _.forEach(values, function(value) {

                            var year = String(value["@time"]).slice(0,4)
                            var key1 = value["@cat01"] + value["@area"] + year
    
                            switch (value["@cat02"]){
                                case "100":
                                    unit1[key1] = value["$"]
                                    break
                                case "110":
                                    unit2[key1] = value["$"]
                                    break
                                default:
                                    var month = convertMonth(value["@cat02"])
                                    var key2 = key1 + month
                                    if ((key2 in datas) == false){
                                        datas[key2] = {
                                            "date": year + "-" + month + "-1",
                                            "hscode": value["@cat01"],
                                            "area": areanames[value["@area"]][0],
                                            "area_name": areanames[value["@area"]][1],
                                            "q1": "",
                                            "q2": "",
                                            "value": "",
                                            "unit1": key1 in unit1 ? unit1[key1] : "",
                                            "unit2": key1 in unit2 ? unit2[key1] : "",
                                            "unit_value": ""
                                            }
                                        }
    
                                    var name = convertName(value["@cat02"])
    
                                    datas[key2][name] = value["$"]
                                    if ("@unit" in value){
                                        datas[key2]["unit_value"] = value["@unit"]
                                        }
    
                                }
                            });
                        }

                }).fail(function(jqXHR, textStatus, errorThrown) {

                    alert('ファイルの取得に失敗しました。');
                    console.log("ajax通信に失敗しました");
                    console.log("jqXHR          : " + jqXHR.status); // HTTPステータスが取得
                    console.log("textStatus     : " + textStatus);    // タイムアウト、パースエラー
                    console.log("errorThrown    : " + errorThrown.message); // 例外情報
                    console.log("URL            : " + url);
                    next_key = ""
            });

        } while (next_key != "")

        for (key in datas){
            tableData.push(datas[key])
        }
        return tableData
    };

    myConnector.getData = function (table, doneCallback) {

        var args = JSON.parse(tableau.connectionData)
        var parms = argsToParms(args)
        var statsDataIds = getStatsDataIds(args)

        _.forEach(statsDataIds, function(statsDataId){
            console.log(statsDataId)
            table.appendRows(getStatsData(parms,statsDataId))
        })

        doneCallback()

    };
  
    tableau.registerConnector(myConnector);



    $(document).ready(function() {
         $("#submitButton").click(function() {
             tableau.connectionData = JSON.stringify({
                                        "appId": $("#appId").val(),
                                        "area": $("#area").val(),
                                        "hscode": $("#HSCode").val(),
                                        "year": $("#daterange").val()
                                         })
             tableau.connectionName = "品別国別表";
             tableau.submit();
         });

         $("#countButton").click(function() {
            alert("hoge");
        });

    }); 

})();