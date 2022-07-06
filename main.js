import Apify from 'apify';


const isInstagram = urlString=> {
      var urlPattern = new RegExp('"/^\s*(http\:\/\/)?instagram\.com\/[a-z\d-_]{1,255}\s*$/i"'); // validate fragment locator
     return !!urlPattern.test(urlString);
}

const isValidLinkTree = urlString=>{
   var urlPattern = new RegExp('(?:https.+?linktr\.ee(?:%2F|.+?)):?\s?([a-zA-Z0-9_.-]+)');
   return !!urlPattern.test(urlString);
}

const isValidUrl = urlString=> {
      var urlPattern = new RegExp('^(https?:\\/\\/)?'+ // validate protocol
       '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // validate domain name
       '((\\d{1,3}\\.){3}\\d{1,3}))'+ // validate OR ip (v4) address
       '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // validate port and path
       '(\\?[;&a-z\\d%_.~+=-]*)?'+ // validate query string
       '(\\#[-a-z\\d_]*)?$','i'); // validate fragment locator
     return !!urlPattern.test(urlString);
}

Apify.main(async () => {


//const { name, profiles, domains } = await Apify.getInput();

const input = await Apify.getInput();
console.log(input['profiles']);
const name =  Array.from(new Set(input.name));
const profiles = Array.from(new Set(input.profile));
const domains = Array.from(new Set(input.domain));

const directUrls = profiles;
console.log(profiles);
//profiles scrape
//name scraope
const insta_valid = [];
//https://stackoverflow.com/questions/18399997/url-validation-in-javascript-instagram-validation
/*insta_re = "/^\s*(http\:\/\/)?instagram\.com\/[a-z\d-_]{1,255}\s*$/i"
for(item in profiles){
   if !(item.test(insta_re)){insta_valid.push(item);}  
}
//first print invalud
console.log(insta_valid);*/


const instagramCall = await Apify.metamorph('jaroslavhejlek/instagram-scraper', { 
   ...input,
   resultsType: "details",
   directUrls, 
   "resultsType": "details",
   "resultsLimit":1,
   proxy: {
      "useApifyProxy": true,
      "apifyProxyGroups": ["RESIDENTIAL"]
   },
});
/*
if isValidUrl

add url misses here in hashmap
 Object.keys(dict).map(function(k){
    return dict[k];
}).join(',');

"
(?:https.+?linktr\.ee(?:%2F|.+?)):?\s?([a-zA-Z0-9_.-]+)
//https://regex101.com/library/V0QtXe?amp%3Bsearch=card&orderBy=LEAST_POINTS&page=348
*/
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