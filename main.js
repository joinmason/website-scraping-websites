import Apify from 'apify';

/* THIS SCRIPT ONLY WORKS WHEN EVERY PROVIDED LIST IS EQUAL LENGTH FOR INPUTS (KEEPS TRACK OF ID/MERCHANT) */
// Ported from https://github.com/zpelechova/instagram-miniactors/blob/main/instagram-profile/main.js

/* VALIDATORS AND CLEANERS */
// Take any urls and check for misconfigs from sales/onboarding inputs
function cleanInstagram(urlString) {
   // https://stackoverflow.com/questions/1707299/how-to-extract-a-string-using-javascript-regex
   // https://regexr.com/5tbdb      (?<=instagram.com\/)[A-Za-z0-9_.]+
   
   //(?<=instagram.com\/)[A-Za-z0-9_.]+");
   // uses a regex string to parse out the username and adds it to a properly formatted url for apify
   var usernamePattern = new RegExp("(?<=[Ii][Nn][Ss][Tt][Aa][Gg][Rr][Aa][Mm].[Cc][Oo][Mm]\/)[A-Za-z0-9_.]+");
   return  urlString.match(usernamePattern) != null ? "https://www.instagram.com/"+ urlString.match(usernamePattern)[0] +"/" :  urlString.match(usernamePattern);
}

// Verifies it is an actual instagram url without a request
function isInstagram(urlString){
   // https://stackoverflow.com/questions/18399997/url-validation-in-javascript-instagram-validation
   // uses regex to verify that it has no spaces and is in the proper format else will be disincluded from requests
   var urlPattern = new RegExp("(?:(?:http|https):\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/([A-Za-z0-9-_\.]+)"); // validate fragment locator
   return !!urlPattern.test(urlString);
}

// checks for valid linktree to pull requests
const isValidLinkTree = urlString=>{
   // https://regex101.com/library/V0QtXe?amp%3Bsearch=card&orderBy=LEAST_POINTS&page=348
   var urlPattern = new RegExp('(?:https.+?linktr\.ee(?:%2F|.+?)):?\s?([a-zA-Z0-9_.-]+)$/i');
   return !!urlPattern.test(urlString);
}

// checks if the url is valid without spaces to be requested
const isValidUrl = urlString=> {
   // https://validators.readthedocs.io/en/latest/_modules/validators/url.html
   
   // https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
      var urlPattern = new RegExp('^(https?:\\/\\/)?'+ // validate protocol
       '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // validate domain name
       '((\\d{1,3}\\.){3}\\d{1,3}))'+ // validate OR ip (v4) address
       '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // validate port and path
       '(\\?[;&a-z\\d%_.~+=-]*)?'+ // validate query string
       '(\\#[-a-z\\d_]*)?$','i'); // validate fragment locator
     return !!urlPattern.test(urlString);
}

Apify.main(async () => {

const input = await Apify.getInput();
//const accountId =  Array.from(new Set(input.accountId));
const names =  Array.from(new Set(input.names));
const profiles = Array.from(new Set(input.profiles));
const domains = Array.from(new Set(input.domains));


let directUrls = [];

// replaces all invalidated instagrams with valid urls, also creates list of valid ones with proper usernames to be passed to apify
for (const url of profiles){
   //console.log(url);
   let instaURL = cleanInstagram(url);
   
   if (instaURL != null && isInstagram(instaURL)) {
   directUrls.push(instaURL);
   //console.log(instaURL);
  }
}
console.log(directUrls);
// call the scraper for instagram on the list of accounts
const instagramCall = await Apify.call('jaroslavhejlek/instagram-scraper', { 
   ...input,
   resultsType: "details",
   directUrls, 
   "resultsType": "details",
   "resultsLimit":1,
   proxy: {
      "useApifyProxy": true,
      "apifyProxyGroups": ["RESIDENTIAL"]
   },
   },
   memoryMbytes: 2048
);

const { datasetId } = instagramCall;
 
// get Instagram dataset items
const { items } = client.dataset(datase.tId).list();
const linkTreesToCheck = [];
 
for (const item of items) {
  const { biography, url } = item;
  if (biography.includes('linktr.ee')) {
     linkTreesToCheck.push({ link: biography.match('linktr.ee'), url });
  } else {
     await Apify.pushData({ payInBio: biography.includes('/pay.withcherry.com/'), url });
  }
}
 
if (linkTreesToCheck.length) {
   // this is a web-scraper task that will only receive the URLS/need another task actor for just the links, and then for the other actor just have the liks
   const linkTreeRun = await Apify.callTask('pay-with-cherry-domain', {
      startUrls: linkTreesToCheck.map(({ url, link }) => ({
          url: link,
          userData: {
              url // this is the instagram profile, so we can link them after
          }
      }))
   });
   // the data is available in request.userData.url inside the page function
   const { items } = await client.dataset(linkTreeRun.defaultDatasetId).list();
    
   for (const { payInLinktree, url } of items) {
       await Apify.pushData({ payInLinktree, url });
   }
}
 
if (domains.length) {
   // this is another task that will take the domains from input
   const domainRun = await Apify.callTask('pay-with-cherry-domain', {
      startUrls: domains.map((url) => ({
          url,
      })),   
   });
    
   // the request.url will be available inside the page function
   const { items } = await client.dataset(domainRun.defaultDatasetId).list();
    
   for (const { payInWebsite, url } of items) {
       await Apify.pushData({ payInWebsite, url });
   }
}


});


/*
Scraps to be deleted later
if isValidUrl

add url misses here in hashmap
 Object.keys(dict).map(function(k){
    return dict[k];
}).join(',');

"
(?:https.+?linktr\.ee(?:%2F|.+?)):?\s?([a-zA-Z0-9_.-]+)
//https://regex101.com/library/V0QtXe?amp%3Bsearch=card&orderBy=LEAST_POINTS&page=348

//https://stackoverflow.com/questions/18399997/url-validation-in-javascript-instagram-validation
/*insta_re = "/^\s*(http\:\/\/)?instagram\.com\/[a-z\d-_]{1,255}\s*$/i"
for(item in profiles){
   if !(item.test(insta_re)){insta_valid.push(item);}  
}
//first print invalud
console.log(insta_valid);
//test results limit and then also test if the call is possible on it
// /(?:(?:http|https):\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/([A-Za-z0-9-_\.]+)/im


*/