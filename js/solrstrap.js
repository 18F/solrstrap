//CONST- CHANGE ALL THESE TO TELL SOLRSTRAP ABOUT THE LOCATION AND STRUCTURE OF YOUR SOLR

var SERVERROOT = 'http://ckan.lo:8080/solr/collection1/select'; //SELECT endpoint
var HITTITLE = 'title';                                        //Name of the title field- the heading of each hit
var HITBODY = 'notes';                                          //Name of the body field- the teaser text of each hit
var HITSPERPAGE = 20;                                          //page size- hits per page
//var FACETS = ['tags'];                       //facet categories
var FACETS = [ 'contact-email', 'contact-name', 'harvest_source_title', 'responsible-party',  'metadata-type', 'collection_metadata', 'config', 'coupled-resource', 'dataset_type', 'entity_type', 'license', 'res_format','tags','organization'];                       //facet categories
//var FACETS_RANGES = ['date':['0','1','2']];
var FACETS_RANGES = [];
var GROUP= ['contact-email'];
var SAVEGROUP= GROUP;
//var GROUP = null;

//var FACETS_TITLES = {'tags': 'tags'};  // selective rename facet names for display
var FACETS_TITLES = {'res_format':'Format', 'metadata_type':'Dataset Type'};  // selective rename facet names for display

var HITID = 'name'              // Name of the id field
var HITTEASER = 'notes';        // Name of field to use for teaser
var HITLINK = 'name';           // Name of field to use for link
function rewrite_hitlink(link)
{
        return '/dataset/'+link;
}
var HL = false;
var HL_FL = 'name, title';
var HL_SIMPLE_PRE = '<em>';
var HL_SIMPLE_POST = '</em>';
var HL_SNIPPETS = 3;

var AUTOSEARCH_DELAY = 0;

//when the page is loaded- do this
  $(document).ready(function() {
    $('#solrstrap-hits').append('<div offset="0"></div>');
    $('#solrstrap-searchbox').attr('value', getURLParam('q'));
    $('#solrstrap-searchbox').focus();
    //when the searchbox is typed- do this
    $('#solrstrap-searchbox').keyup(keyuphandler);
    $('form.navbar-search').submit(handle_submit);
    $(window).bind('hashchange', hashchange);
    $('#solrstrap-searchbox').bind("change", querychange);
    hashchange();
  });

  //jquery plugin allows resultsets to be painted onto any div.
  (function( $ ){
    $.fn.loadSolrResults = function(q, fq, offset) {
      $(this).getSolrResults(q, fq, offset);
    };
  })( jQuery );


  //jquery plugin allows autoloading of next results when scrolling.
  (function( $ ){
    $.fn.loadSolrResultsWhenVisible = function(q, fq, offset) {
      elem = this;
      $(window).scroll(function(event){
        if (isScrolledIntoView(elem) && !$(elem).attr('loaded')) {
          //dont instantsearch and autoload at the same time
          if ($('#solrstrap-searchbox').val() != getURLParam('q')) {
	    handle_submit();
          }
          $(elem).attr('loaded', true);
          $(elem).getSolrResults(q, fq, offset);
          $(window).unbind('scroll');
        }
      });
    };
  })( jQuery );


  //jquery plugin for takling to solr
  (function( $ ){
    var TEMPLATES = {
    'hitTemplate':Handlebars.compile($("#hit-template").html()),
    'summaryTemplate':Handlebars.compile($("#result-summary-template").html()),
    'navTemplate':Handlebars.compile($("#nav-template").html()),
    'chosenNavTemplate':Handlebars.compile($("#chosen-nav-template").html())
    };
    Handlebars.registerHelper('facet_displayname', function(facetname) {
	return((FACETS_TITLES && FACETS_TITLES.hasOwnProperty(facetname)) ?
	       FACETS_TITLES[facetname] : facetname);
      });
    $.fn.getSolrResults = function(q, fq, offset) {
      var rs = this;
      $(rs).parent().css({ opacity: 0.5 });
      $.ajax({url:SERVERROOT,
	      dataType: 'jsonp',
	      data: buildSearchParams(q, fq, offset), 
	      traditional: true,
	      jsonp: 'json.wrf',
	      success: 
	      function(result){
		 console.log(result);
                 var doclength = 0;
		//
		if (result.grouped)
                {
                  // let's move the response around..
                  doclength = result.grouped[GROUP[0]].groups.length;
                  result.response = {};
                  result.response.numFound = result.grouped[GROUP[0]].ngroups;
                }
                  else 
			{
			doclength = result.response.docs.length;
			}
	          console.log(doclength);
		//only redraw hits if there are new hits available
		if (doclength > 0) {
		  if (offset == 0) {
		    rs.empty();
		    //strapline that tells you how many hits you got
		    rs.append(TEMPLATES.summaryTemplate({totalresults: result.response.numFound, query: q}));
		    rs.siblings().remove();
		  }
		  //draw the individual hits
		  for (var i = 0; i < doclength ; i++) {
		    var hit_data = normalize_hit(result, i);


		    rs.append(TEMPLATES.hitTemplate(hit_data));
		  }
		  $(rs).parent().css({ opacity: 1 });
		  //if more results to come- set up the autoload div
		  if ((+HITSPERPAGE+offset) < +result.response.numFound) {
		    var nextDiv = document.createElement('div');
		    $(nextDiv).attr('offset', +HITSPERPAGE+offset);
		    rs.parent().append(nextDiv);
		    $(nextDiv).loadSolrResultsWhenVisible(q, fq, +HITSPERPAGE+offset);
		  }
		  if (offset === 0) {
		    //facets
		    $('#solrstrap-facets').empty();
		    //chosen facets
		    if (fq.length > 0) {
		      var fqobjs = [];
		      for (var i = 0; i < fq.length; i++) {
			var m = fq[i].match(/^([^:]+):(.*)/);
			if (m) {
			  fqobjs.push({'name': m[1], 'value': m[2]});
			}
		      }
		    }
		    $('#solrstrap-facets').append(TEMPLATES.chosenNavTemplate(fqobjs));
		    //available facets
		    var k;
		    for (k in result.facet_counts.facet_fields) {
		      if (result.facet_counts.facet_fields[k].length > 0) {
			$('#solrstrap-facets')
			  .append(TEMPLATES.navTemplate({
			    title: k,
			    navs:
			    makeNavsSensible(result.facet_counts.facet_fields[k])}));
		      }
		    }
		    for (k in result.facet_counts.facet_ranges) {
		      if (result.facet_counts.facet_ranges[k].counts.length > 0) {
			$('#solrstrap-facets')
			  .append(TEMPLATES.navTemplate({
			    title: k,
			    navs:
			    makeNavsSensible(result.facet_counts.facet_ranges[k].counts)}));
		      }
		    }
		    $('div.facet-group > a').click(add_nav_group);
		    $('div.group-group > a').click(add_nav_group_group);
		    $('div.facet > a').click(add_nav);
		    $('div.chosen-facet > a').click(del_nav);
		    $('#group-label').html(GROUP[0]);
		  }}
	      }});
    };
  })( jQuery );


  //translates the ropey solr facet format to a more sensible map structure
  function makeNavsSensible (navs) {
    var newNav = {};
    for (var i = 0; i < navs.length; i+=2) {
      newNav[navs[i]] = navs[i + 1];
    }
    return newNav;
  }

  //utility function for grabbling URLs
  function getURLParam(name) {
    var ret = $.bbq.getState(name);
    return ret;
  }

  //function to generate an array of URL parameters, where there are likely to be several params with the same key
  function getURLParamArray(name) {
    var ret =  $.bbq.getState(name) || [];
    if (typeof(ret) == 'string')
      ret = [ret];
    return ret;
  }

  //utility function that checks to see if an element is onscreen
  function isScrolledIntoView(elem) {
    var docViewTop = $(window).scrollTop();
    var docViewBottom = docViewTop + $(window).height();
    var elemTop = $(elem).offset().top;
    var elemBottom = elemTop + $(elem).height();
    return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop));
  }

  function buildSearchParams(q, fq, offset) {
    var ret = { 
    'rows': HITSPERPAGE,
    'wt': 'json',
    'q': q,
    'start': offset
    }
    if (FACETS.length > 0) {
      ret['facet'] = 'true';
      ret['facet.mincount'] = '1';
      ret['facet.limit'] = '20';
      ret['facet.field'] = FACETS;
    }
    if (FACETS_RANGES) {
      var ranges = [];
      for (facet in FACETS_RANGES) {
	if (FACETS_RANGES.hasOwnProperty(facet)) {
	  ranges.push(facet);
	  var facetdata = FACETS_RANGES[facet];
	  ret['f.'+facet+'.facet.range.start'] = facetdata[0];
	  ret['f.'+facet+'.facet.range.end']= facetdata[1];
	  ret['f.'+facet+'.facet.range.gap']= facetdata[2];
	}
      }
      ret['facet.range'] = ranges;
    }
    if (fq.length > 0) {
      ret['fq'] = fq;
    }
    if (HL_FL) {
      ret['hl'] = 'true';
      ret['hl.fl'] = HL_FL;
      ret['hl.simple.pre'] = HL_SIMPLE_PRE;
      ret['hl.simple.post'] = HL_SIMPLE_POST;
      ret['hl.snippets'] = HL_SNIPPETS;
    }

    var group = getURLParamArray("group");
    if (group && group.length) GROUP[0]=group;

    if (fq.length==0) {
      ret['group'] = true;
      ret['group.field'] = GROUP[0];
      ret['group.ngroups'] = true;
    }

    return ret;
  }

  //optionally convert a string array to a string, by concatenation
  function array_as_string(object)
  {
    if (typeof(object) == 'object' 
	&& object.hasOwnProperty('length') 
	&& object.length > 0) {
      
      return object.join("; ");
    }
    return object;
  }

  //normalize a string with respect to whitespace:
  //1) Remove all leadsing and trailing whitespace
  //2) Replace all runs of tab, space and &nbsp; with a single space
  function normalize_ws(object) 
  {
    if (typeof(object) === 'string') {
      return object.replace(/^\s+/, '')
	.replace(/\s+$/, '')
	.replace(/(?: |\t|&nbsp;|&#xa0;|\xa0)+/g, ' ');
    }
    return object;
  }


  //get field from result for document i, optionally replacing with
  //highlit version
  function get_maybe_highlit(result, i, field) 
  {
    var res = result.response.docs[i][field];
    if (HL) {
      var id = result.response.docs[i][HITID];
      var hl_map = result.highlighting[id];
      if (hl_map.hasOwnProperty(field)) {
	res = hl_map[field];
      }
    }

    return array_as_string(res);
  }

  //handler for navigator selection
  function add_nav(event) 
  {
    var whence = event.target;
    var navname = $(whence).closest("div.facet").children("span.nav-title").data("facetname");
    var navvalue = $(whence).text();
    var newnav = navname + ':"' + navvalue.replace(/([\\\"])/g, "\\$1") + '"';
    var fq = getURLParamArray("fq");

    // check if it already exists...
    var existing = $.grep(fq, function(elt, idx) {
	return elt === newnav;
      });

    if (existing.length === 0) {
      fq.push(newnav);
      $.bbq.pushState({'fq': fq});
    }
    return false;
  }
  function add_nav_group(event) 
  {
    var whence = event.target;
    var navname = GROUP[0];
    var navvalue = $(whence).text();
    var newnav = navname + ':"' + navvalue.replace(/([\\\"])/g, "\\$1") + '"';
    var fq = getURLParamArray("fq");

    // check if it already exists...
    var existing = $.grep(fq, function(elt, idx) {
	return elt === newnav;
      });

    if (existing.length === 0) {
      fq.push(newnav);
      $.bbq.pushState({'fq': fq});
    }
    return false;
  }
  function add_nav_group_group(event) 
  {
console.log("AJS");
    var whence = event.target;
    var navvalue = $(whence).text();
    var group= getURLParamArray("group");
    navvalue = navvalue.replace(/([\\\"])/g, "\\$1");


    GROUP[0]=navvalue;

console.log("navvalue: "+navvalue);
     group = [];

    // check if it already exists...
    var existing = $.grep(group, function(elt, idx) {
console.log("exists");
	return elt === navvalue;
      });

    if (existing.length === 0) {
console.log("new");
      group.push(navvalue);
      $.bbq.pushState({'group': group});
    }
    return false;
  }
 // <option value="extras_responsible-party">Responsible Party</option>

  //handler for navigator de-selection
  function del_nav(event) 
  {
    var whence = event.target;
    if ($(whence).hasClass("close")) {
      whence = $(whence).next();
    }
    // var filter = $(whence).text();
    var filter = $(whence).data("filter");    
    var fq = getURLParamArray("fq");

    fq = $.grep(fq, function(elt, idx) {
	return elt === filter;
      }, true);

    if (fq.length==0)
	GROUP=SAVEGROUP;

    $.bbq.pushState({"fq": fq});
    return false;
  }

  function hashchange(event)
  {
    $('#solrstrap-hits div[offset="0"]').loadSolrResults(getURLParam('q'), getURLParamArray('fq'), 0);
  }

  function handle_submit(event)
  {
    var q = $.trim($('#solrstrap-searchbox').val());
    if (q !== '') {
      $.bbq.removeState("fq");
      $.bbq.removeState("q");
      $.bbq.pushState({'q': q});
    }
    return false;
  }

  var querychange = handle_submit;

  var timeoutid;
  function keyuphandler()
  {
    if (AUTOSEARCH_DELAY >= 0) {
      if (timeoutid) {
	window.clearTimeout(timeoutid);
      }
      timeoutid = window.setTimeout(maybe_autosearch, AUTOSEARCH_DELAY);
    }
  }

  function maybe_autosearch()
  {
    if (timeoutid) {
      window.clearTimeout(timeoutid);
    }
    var q = $.trim($('#solrstrap-searchbox').val());
    if (q.length > 3 && q !== getURLParam("q")) {
      $('#solrstrap-hits div[offset="0"]').loadSolrResults(q, [], 0);
    }
    else {
      // $('#solrstrap-hits').css({ opacity: 0.5 });
    }
  }

  function normalize_hit(result, i) {
    var hit_data;

   if (result.grouped)
   {
    hit_data = $.extend({}, result.grouped[GROUP[0]].groups[i].doclist.docs[0]);
   }
   else
   {
    hit_data = $.extend({}, result.response.docs[i]);
   }

    if (result.hasOwnProperty("highlighting")) {
      $.extend(hit_data, result.highlighting[hit_data[HITID]]);
    }

    // hysterical-raisins-are-us: 
    // these mappings are provided for compatibility with code that
    // assumes that the hit data is composed of title, body, link &
    // teaser. it is probably better to use the field names actually
    // returned by SOLR.
    if (HITTITLE || HITLINK || HITBODY || HITTEASER) {
      var aux = {};
      if (HITTITLE) {
        if (result.grouped)
        {
	  aux.title = result.grouped[GROUP[0]].groups[i].doclist.numFound+' ['+result.grouped[GROUP[0]].groups[i].groupValue+'] '+hit_data[HITTITLE];
          aux.group = result.grouped[GROUP[0]].groups[i].groupValue;
        }
        else
	  aux.title = hit_data[HITTITLE];
      }
      if (HITLINK) {
	aux.link = rewrite_hitlink(hit_data[HITLINK]);
      }
      if (HITBODY) {
	aux.text = hit_data[HITBODY];
      }
      if (HITTEASER) {
	aux.teaser = hit_data[HITBODY];
      }
      $.extend(hit_data, aux);
    }
    /*
    for (k in hit_data) {
      hit_data[k] = normalize_ws(array_as_string(hit_data[k]));
    }
    */
    return hit_data;
  }
