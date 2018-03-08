(function () {
  var d = document, 
    txt = d.getElementById("searchblank"), 
    btn = d.getElementById("searchbtn"),
    searchcount = d.getElementById("searchedfeatures"),
    resultcount = d.getElementById("searchresultscount"),
    resultList = d.getElementById("searchresults"),
    locs, hits;
		
	/**
   * requests data from a URL and returns it in JSON format
   * @function ajax
   * @param {string} u - URL to send the requests
   * @param {function} callback - function to call when results are returned
   * @param {object} [data] - optional information to send, triggers a post instead of a get requests
   * @param {object} [x] - state of the application
   */
  function ajax(u, callback, data, x) {
    try {
      x = new(this.XMLHttpRequest)("MSXML2.XMLHTTP.3.0");
      x.open(data ? "POST" : "GET", u, 1);
      x.setRequestHeader("X-Requested-With", "XMLHttpRequest");
      x.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      x.onreadystatechange = function () {
        var processedResponseText;
        if (x.readyState > 3 && callback) {
          // JSON.parse doesn't handle NaN values where numbers are supposed to go
          processedResponseText = (x.responseText || "{}").replace(/:\s*NaN,/ig, ':"NaN",');
          callback(JSON.parse(processedResponseText), x);
        }
      };
      x.send(data);
    } catch (e) {
      window.console && console.log(e);
    }
  }
  
	// get values of dot.notated.parameters out of a JSON object
	// @param {string[]} fields - list of fields
	// @param {object} data - JSON object.
  function getFinalVal(fields, data) {
    var result = data.hasOwnProperty(fields[0]) ? data[fields[0]] : null;
    if (result != null && fields.length > 1) {
      if (result instanceof Array) {
        return result.map(function (item) {
          return getFinalVal(fields.slice(1), item);
        });
      }
      return getFinalVal(fields.slice(1), result);
    }
    return result;
  }
  // displays a link to a map service REST endpoint with data that matches the search.
  // @param {string} field
  // @param {string} result
  // @param {string} url
  function printResult(field, result, url) {
    var li = d.createElement("li"), link = d.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("target", "_blank");
    link.innerHTML = ["<b>Source: </b>", url.replace(/^\S*\/rest\/services\//i, "."), "<br /><b>", field, ": </b>", result].join("");
    li.appendChild(link);
    resultList.appendChild(li);
  }

  // test if the result matches the search. If so, increments the hit counter and displays the result.
  function checkAndPrint(myTest, field, result, url) {
    if (myTest(result)) {
      hits++;
      printResult(field, result, url);
    }
  }

  // collect values from the data, and send the data off for testing.
  function responseSearch(url, data, myTest) {
    var fieldList = ["name", "description", "displayField", "fields.name", "fields.alias", "mapName", "layers.name", "documentInfo.Title", "documentInfo.Comments", "documentInfo.Subject", "documentInfo.Category", "documentInfo.Keywords", "folders", "services.name", "services.type"];
    fieldList.forEach(function (field) {
      var result = getFinalVal(field.split("."), data);
      if (result == null) { return; }
      if (result instanceof Array) {
        result.forEach(function (item) {
          checkAndPrint(myTest, field, item, url);
        });
      } else {
        checkAndPrint(myTest, field, result, url);
      }
    });
  }
	
  // returns a list of child folders for the current service.
  function subUrls(url, data) {
    var list = [],
      runners = {
        "folders": function (folder) { return [url, folder].join("/"); },
        "services": function (service) { return [url, service.name.replace(/\w+\//ig, ""), service.type].join("/"); },
        "layers": function (layer) { return [url, layer.id].join("/"); },
        "tables": function (table) { return [url, table.id].join("/"); }
      }, r;
    for (r in runners) {
      if (data[r] && data[r].length) {
        list = list.concat(data[r].map(runners[r]));
      }
    }
    return list;
  }

  // given a list of urls and a testing function, requests data from the first url in the list, searches the JSON response,
  // and if there are more urls in the list, calls itself again.
  // @param {string[]} list - list of urls
  // @param {function} myTest - test to perform on the results to see if it matches.
  function queryMe(list, myTest) { 
    if (!list.length) { return; }
    var url = list.shift();
    ajax(url + "?f=json",
      function (data) {
        locs++;
        responseSearch(url, data, myTest);
        list = list.concat(subUrls(url, data));
        searchcount.innerHTML = locs.toString();
        resultcount.innerHTML = hits.toString();
        if (list.length) {	
          queryMe(list, myTest); 
        } else {
          btn.removeAttribute("disabled");
          btn.innerHTML = "Search";
          Array.prototype.forEach.call(d.getElementsByTagName("a"), function (ln) {
            var location = ln.href;
            ln.addEventListener("click", function () {
              chrome.tabs.create({active: true, url: location});
            });
          });
        }
      });
  }
	// function called on mouse click, parses searches, sets up tests, and queries the current REST service.
  btn.addEventListener("click", function () {
    var searchFor, myTest;
    if (txt.value) {
      // clear the list
      while (resultList.childNodes.length) {
        resultList.removeChild(resultList.childNodes[0]);
      }
      btn.innerHTML = "Scanning";
      btn.setAttribute("disabled", "disabled");
      searchcount.innerHTML = "";
      resultcount.innerHTML = "";

      if (/^\d*\.?\d+$/.test(txt.value)) {
        searchFor = /\./.test(txt.value) ? parseFloat(txt.value) : parseInt(txt.value, 10);
        myTest = function (val) { return val === searchFor; };
      } else {
        searchFor = new RegExp(txt.value, "i");
        myTest = function (val) { return searchFor.test(val); };
      }
      locs = 0;
      hits = 0;
      chrome.tabs.query({highlighted: true}, function(tabs) {
        tabs.forEach(function (tab) {
          queryMe([tab.url.replace(/\?[\B]*$/, "")], myTest);
        });
      });
    } else { alert("Please enter a value"); }
    return false;
  }, false);
	
}());