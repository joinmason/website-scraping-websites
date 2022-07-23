import { Actor } from 'apify';
import { KeyValueStore } from 'crawlee';






/* THIS SCRIPT ONLY WORKS WHEN EVERY PROVIDED LIST IS EQUAL LENGTH FOR INPUTS (KEEPS TRACK OF ID/MERCHANT) */
// Ported from https://github.com/zpelechova/instagram-miniactors/blob/main/instagram-profile/main.js

/* VALIDATORS AND CLEANERS */
// Take any urls and check for misconfigs from sales/onboarding inputs
function cleanInstagram(urlString: string) {
   // https://stackoverflow.com/questions/1707299/how-to-extract-a-string-using-javascript-regex
   // https://regexr.com/5tbdb      (?<=instagram.com\/)[A-Za-z0-9_.]+
   
   //(?<=instagram.com\/)[A-Za-z0-9_.]+");
   // uses a regex string to parse out the username and adds it to a properly formatted url for apify
   var usernamePattern = new RegExp("(?<=[Ii][Nn][Ss][Tt][Aa][Gg][Rr][Aa][Mm].[Cc][Oo][Mm]\/)[A-Za-z0-9_.]+");
   return  urlString.match(usernamePattern) != null ? "https://www.instagram.com/"+ urlString.match(usernamePattern)?.[0] +"/" :  urlString.match(usernamePattern);
}

// Verifies it is an actual instagram url without a request
function isInstagram(urlString: string){
   // https://stackoverflow.com/questions/18399997/url-validation-in-javascript-instagram-validation
   // uses regex to verify that it has no spaces and is in the proper format else will be disincluded from requests
   var urlPattern = new RegExp("(?:(?:http|https):\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/([A-Za-z0-9-_\.]+)"); // validate fragment locator
   return !!urlPattern.test(urlString);
}

// checks for valid linktree to pull requests
const isValidLinkTree = (urlString: string) =>{
   // https://regex101.com/library/V0QtXe?amp%3Bsearch=card&orderBy=LEAST_POINTS&page=348
   var urlPattern = new RegExp('(?:https.+?linktr\.ee(?:%2F|.+?)):?\s?([a-zA-Z0-9_.-]+)$/i');
   return !!urlPattern.test(urlString);
}

// checks if the url is valid without spaces to be requested
const isValidUrl = (urlString: string) => {
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





// get the websites, instagrams, zapier salesforce -> data set in apify, schedule a couple hours later inside apify
// clean urls, it wont be included in teh scrapes, marked as false in the final csv
// id, website, instagram (can include in task)
// scrape instagram  (call)
// scrape linktrees from instagram (call task)
// scrape websites (call task)
await Actor.init();

const client = Actor.newClient();

const buildState = (items: any[]) => {
   return items.reduce((o, i) => ({ 
      ...o, 
      [i.id]: {
         ...i,
         payInBio: false,
         payInWebsite: false,
         payInLinktree: false
      }
   }), {});
}

const { startItems } = await Actor.getInput() as any;

const STATE = await Actor.getValue('STATE') || buildState(startItems);

const findId = (prop: string, toSearch: any) => {
   return startItems.find((item: any) => item[prop] == toSearch)?.id;
}

/**
 * {
 *    id: {
 *      id: any
 *      profile?: string
 *      website?: string
 *      payInBio: boolean,
 *      payInWebsite: boolean,
 *      payInLinktree: boolean
 *    }
 *  
 * }
 * 
 * */
const persistState = async () => {
   await Actor.setValue('STATE', STATE);
}

Actor.on('migrating', persistState);
Actor.on('aborting', persistState);

/**
 * @param {string} id
 * @param {(items: any[]) => Promise<void>} cb 
 */
const paginateItems = async (id: string, cb: (items: any[]) => Promise<void>) => {
   let offset = 0;

   while (true) {
      const { items } = await client.dataset(id).listItems({
         limit: 1000,
         offset,
      });

      if (!items.length) {
         break;
      }

      offset += items.length;

      await cb(items);
   }
}

let directUrls = [];

const pluck = (prop: string) => startItems.map((item: any) => item[prop])

// replaces all invalidated instagrams with valid urls, also creates list of valid ones with proper usernames to be passed to apify
// pluck the profile from startItems
for (const url of pluck('profile')){
   //console.log(url);
   let instaURL = cleanInstagram(url);
   
//    if (instaURL != null && isInstagram(instaURL)) {
   directUrls.push(instaURL);
   //console.log(instaURL);
  //}
}
/*// console.log(directUrls);
// call the scraper for instagram on the list of accounts
const instagramCall = await Actor.call('jaroslavhejlek/instagram-scraper', { 
   resultsType: "details", // posts, comments, details, users
   directUrls, 
   proxy: {
      "useApifyProxy": true,
      "apifyProxyGroups": ["RESIDENTIAL"]
   }
},
  //{memoryMbytes: 2048}
);

const { defaultDatasetId: igID } = instagramCall;

const linkTreesToCheck = [];

await paginateItems(igID, async (items) => {
   for (const item of items) {
     const { biography, username } = item;
     const profile = `https://www.instagram.com/${username}`;

    
     const currentObject = STATE[findId('profile', profile)];

     if (biography.includes('linktr.ee')) {
        linkTreesToCheck.push({ 
           link: biography.match(/(https?:\/\/linktr\.ee\/[^\s]+)/)?.[1], 
           url: profile,
        });
        // theres externalUrl property thats the clean URL for the linktr.ee
        currentObject.payInBio = false;
     } else {
        currentObject.payInBio = true;
     }
   }
});
 
if (linkTreesToCheck.length) {
   await persistState();

   // this is a web-scraper task that will only receive the URLS/need another task actor for just the links, and then for the other actor just have the liks
   const linkTreeRun = await Actor.callTask('important_marker/pay-with-cherry-linktrees', {
      startUrls: linkTreesToCheck.map(({ url, link }) => ({
          url: link,
          userData: {
              url // this is the instagram profile, so we can link them after
          }
      }))
   });

   await paginateItems(linkTreeRun.defaultDatasetId, async (items) => {
     for (const { instagram, payInLinktree } of items) {
         const currentObject = STATE[findId('profile', instagram)];

         currentObject.payInLinktree = payInLinktree;
     }
   })
}*/
 
 const domains = pluck('website');

if (domains.length) {
   await persistState();

   // this is another task that will take the domains from input
   const domainRun = await Actor.callTask('important_marker/pay-with-cherry-domain', {
      startUrls: domains.map((url) => ({
          url,
      })),   
   });
    
   await paginateItems(domainRun.defaultDatasetId, async (items) => {
     for (const { url, payInWebsite } of items) {
         const currentObject = STATE[findId('website', url)];

         currentObject.payInWebsite = payInWebsite;
     }
   })
}

await persistState();
// query file  state and then send the state as json stringify
await Actor.exit();

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




($('a[href*="pay.withcherry.com/"]').length > 0 ||
((widgetElement.includes("cherry") || pageContent.includes("<!-- CHERRY WIDGET BEGIN -->")) && pageContent.includes("payment plans")) ||
(pageContent.includes("payment plans") && $('iframe').length > 0))


$.getJSON('https://api.Actor.com/v2/datasets/BceRv4WmB8VkiDP6J/items?clean=true&format=json', function(data) {
var json = JSON.stringify(data);
var data2 = JSON.parse(json);
var websiteCheck = {};
for (const item in data2){
  var url = new URL(item['url']);
  var host = url.hostname;
  //  //https://stackoverflow.com/questions/1098040/checking-if-a-key-exists-in-a-javascript-object
  if (host in websiteCheck){
    if (websiteCheck[host] == false && item['payInWebsite'] == true){
      websiteCheck[host] = true;
    }
  } else {
    websiteCheck[host] = item['payInWebsite'];
  }
}

});

*/