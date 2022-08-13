import { Actor } from 'apify';
import { KeyValueStore } from 'crawlee';
import { parse } from 'url';
import { createHash } from 'crypto';
import { sleep } from '@crawlee/utils';

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
   return  urlString.match(usernamePattern) != null 
      ? "https://www.instagram.com/"+ urlString.match(usernamePattern)?.[0] +"/" 
      :  urlString.match(usernamePattern)?.[0];
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
         payInLinktree: false,
      }
   }), {});
}

const { startItems } = await Actor.getInput() as any;

const STATE = await Actor.getValue('STATE') || buildState(startItems);

const findId = (prop: string, toSearch: any) => {
   return startItems.find((item: any) => item[prop].includes(toSearch));
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
    const dataset = client.dataset(id);

    await sleep(10000);

    while (true) {
        const { items } = await dataset.listItems({
            limit: 1000,
            offset,
            clean: false,
        });

        if (!items.length) {
            break;
        }

        offset += items.length;

        try {
            await cb(items);
        } catch (e) {
            console.log(e);
        }
    }
}

let directUrls = [];

// replaces all invalidated instagrams with valid urls, also creates list of valid ones with proper usernames to be passed to apify
// pluck the profile from startItems
for (const { id, profile, website } of startItems){
   //console.log(url);
   let instaURL = cleanInstagram(profile);
   
   if (instaURL != null && isInstagram(instaURL)) {
      directUrls.push(instaURL);
   //console.log(instaURL);
   } else {
      await Actor.pushData({ 
         error: `Profile not found/URL formatting invalid`,
         profile,
         id,
         website,
      });
   }
}

/**
 * @param {ReturnType<typeof Apify.newClient>} client
 * @param {string} runId
 */
export const waitForFinish = async (client, runId) => {
    const run = client.run(runId);

    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const { status } = await run.get();

            if (status !== 'RUNNING' && status !== 'READY') {
                break;
            }

            await sleep(1000);
        } catch (e) {
            console.log(e.message);

            break;
        }
    }
};

/**
 * forceCloud allows to test on the platform
 *
 * @param {Apify.ActorRun} run
 * @returns {() => Promise<Record<string, any>>}
 */
export const getRemoteInput = (run) => () => Actor.openKeyValueStore(run.defaultKeyValueStoreId, { forceCloud: true }).then((s) => s.getValue('INPUT'));

/**
 * @param {Apify.ActorRun} run
 */
export const output = (run) => {
    return {
        run,
        input: getRemoteInput(run),
    };
};

/**
 * Make Apify.call idempotent.
 * Wraps the key value store of your choice and keeps the call
 * states there. Same inputs always yield the same call.
 *
 * Provide the idempotencyKey manually to be able to create
 * more calls using the same input, since it defaults to the
 * current Run ID
 *
 * @param {string} actorName Default name
 */
export const persistedCall = async (actorName = '', input = {}, options: any = {}) => {
    const kv = await Actor.openKeyValueStore();

    const calls = new Map<string, any>((await kv.getValue('CALLS')) ?? []);

    // don't try to write all at once for all events
    let persisting = false;

    const persistStateInternal = async () => {
        if (!persisting) {
            persisting = true;
            await kv.setValue('CALLS', [...calls.entries()]);
            persisting = false;
        }
    };

    Actor.on('persistState', persistStateInternal);
    Actor.on('migrating', persistStateInternal);
    Actor.on('aborting', persistStateInternal);

    const inputHash = createHash('md5', { autoDestroy: true })
        .update(`${actorName}${JSON.stringify({ input, options })}`)
        .digest('hex');

    const call = calls.get(inputHash);

    if (call?.id) {
        console.log('Call exists, waiting', call);

        await waitForFinish(
            client,
            call.id,
        );

        console.log('Sleeping for 20s for dataset', call);

        await sleep(20000); // wait for dataset to settle (omg)

        console.log('Slept', call);

        return output(call);
    }

    const run = await client.task(actorName).start(input, options);

    calls.set(inputHash, run);

    await persistStateInternal();

    console.log('Called and waiting', run);

    await waitForFinish(
        client,
        run.id,
    );

    console.log('Sleeping for 20s for dataset', call);

    await sleep(20000); // wait for dataset to settle (omg)

    console.log('Slept', call);

    return output(run);
};


// call the scraper for instagram on the list of accounts
const instagram = await persistedCall('immaculate_scraper/instagram-scraper-task', { 
   directUrls,
}); 

const linkTreesToCheck = [];

await paginateItems(instagram.run.defaultDatasetId, async (items) => {
   for (const item of items) {
     const { biography, username } = item;
     
     if (!biography || !username) {
        if (item["#error"]) {
            const matches = item["#url"].match(/instagram\.com\/([^/]+)/);

            if (matches?.[1]) {
                const item = findId('profile', matches[1]);
                
                const currentObject = STATE?.[item.id];

                await Actor.pushData({ 
                    ...item,
                    error: !biography ? 'Missing username/Contact Apify Support Scraper is Broken' : 'Missing username/Contact Apify Support Scraper is Broken',
                });

                continue;
            }
        }

        await Actor.pushData({ 
           ...item,
           error: !biography ? 'Missing username/Contact Apify Support Scraper is Broken' : 'Missing username/Contact Apify Support Scraper is Broken',
        });
        
        continue;
     }

     const profile = `https://www.instagram.com/${username}/`;
   
     const { id } = findId('profile', username);
     const currentObject = STATE[id];

     if (!currentObject) {
        await Actor.pushData({ 
            error: `${profile} not found/URL formatting invalid`,
            id
        });
        continue;
     }
     
    const sites = [
        /(https?:\/\/msha\.ke\/[^\s]+)/,
        /(https?:\/\/linktr\.ee\/[^\s]+)/,
        /(https?:\/\/instabio\.cc\/[^\s]+)/,
    ];

    let matched = false;

    for (const site of sites) {
        const matches = biography.match(site);

        if (matches?.[1]) {
            linkTreesToCheck.push({ 
                link: matches[1], 
                url: profile,
                id,
            });

            matched = true;
        }
    }
    
    currentObject.payInBio = currentObject.payInBio || matched;
   }
});
 
if (linkTreesToCheck.length) {
   await persistState();

   // this is a web-scraper task that will only receive the URLS/need another task actor for just the links, and then for the other actor just have the liks
   const linkTreeRun = await persistedCall('immaculate_scraper/pay-with-cherry-linktrees', {
      startUrls: linkTreesToCheck.map(({ url, id, link }) => {
         return {
            url: link,
            userData: {
                url, // this is the instagram profile, so we can link them after
                id,
            }
        }
      })
   });

   await paginateItems(linkTreeRun.run.defaultDatasetId, async (items) => {
     for (const { id, payInLinktree } of items) {
         const currentObject = STATE[id];

         if (!currentObject) {
            await Actor.pushData({
               error: `payInLinktree ${id} not found`,
               id,
            });
            continue;
         }

         currentObject.payInLinktree = payInLinktree;
     }
   });
}
 
await persistState();
const domains = [];

for (const { id, website } of startItems) {
   try {
      const parsedUrl = parse(website);

      if (!parsedUrl || !parsedUrl.href) {
         throw new Error('Invalid url');
      }
      
      let fixedUrl = parsedUrl.href;

      if (!parsedUrl.protocol) {
         fixedUrl = `http://${fixedUrl}`;
      }

      try {
         new URL(fixedUrl);
      } catch (e) {
         console.log((e as Error).message);
         continue;
      }

      domains.push({ url: fixedUrl, id });

   } catch (e) {
      await Actor.pushData({
         website,
         error: e.message,
         id,
      });
   }
}

if (domains.length) {
   // this is another task that will take the domains from input
   const domainRun = await persistedCall('immaculate_scraper/pay-with-cherry-domain', {
      startUrls: domains.map(({ url, id }) => ({
          url,
          userData: {
            id,
          }
      })),
   });
    
   await paginateItems(domainRun.run.defaultDatasetId, async (items) => {
     for (const { url, id, payInWebsite } of items) {
         const currentObject = STATE[id];

         if (!currentObject) {
            await Actor.pushData({
               error: `Website not found ${url}`,
               id,
               website: url,
            });
            continue;
         }

         currentObject.url = url;
         currentObject.payInWebsite = payInWebsite;
     }
   });
}

await persistState();

// do for cleanup
await Actor.callTask('immaculate_scraper/zapier-sync', {
   ...Actor.getEnv(),
});


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




TypeError: Cannot read properties of undefined (reading 'includes') 
finding the error and selecting it 
zapier setup
*/