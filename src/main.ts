import { Browser, launch, Page } from 'puppeteer';
import { load } from 'cheerio';
import { format, startOfToday, startOfYesterday, subDays } from 'date-fns';
import { writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

type Partner = {
  name: string;
  url: string;
};

type User = {
  who: string;
  when: string;
  what: string;
  url: string;
  partner?: Partner;
};

const guilds = [
  {
    fileName: `cosa_${format(Date.now(), 'yyyy.MM.dd')}.json`,
    url: buildCosaGuildURL(),
  },
  {
    fileName: `cosa2_${format(Date.now(), 'yyyy.MM.dd')}.json`,
    url: buildCosaGuildURL(false),
  },
];

function buildURL(link: string): string {
  const ROOT_URL = 'https://www.dofus.com';
  return `${ROOT_URL}${link}`;
}

function buildCosaGuildURL(main = true): string {
  const URL_COSA = `/pt/mmorpg/comunidade/anuarios/paginas-guildas/201900202-cosa-nostra`;
  const URL_COSA2 = '/pt/mmorpg/comunidade/anuarios/paginas-guildas/156600202-cosa-nostra-ii';
  return buildURL(main ? URL_COSA : URL_COSA2);
}

async function getContent(page: Page, url: string): Promise<string> {
  await page.goto(url, {
    waitUntil: 'networkidle2',
  });
  return page.content();
}

async function getEvents(page: Page, url: string = buildCosaGuildURL()): Promise<User[]> {
  const content: string = await getContent(page, url);

  const transformTextToDate = (when: string): string => {
    let date;
    if (when.includes('hoje')) {
      date = startOfToday();
    } else if (when.includes('ontem')) {
      date = startOfYesterday();
    } else {
      const daysAgo = Number(when.replace(/\D/g, ''));
      date = subDays(startOfToday(), daysAgo);
    }
    return format(date, 'dd/MM/yyyy');
  };

  const selector = `div[class="ak-character-actions"] >
                    div[class="ak-actions"] >
                    div[class="ak-actions-list"] >
                    div[class*="ak-container ak-content-list"] >
                    div[class="ak-list-element"]`;

  const $ = load(content);
  const events: User[] = [];
  $(selector).each(function (_, element) {
    const $ = load(element);
    const when = transformTextToDate($('span[class="date"]').text());
    const action = $('a[class="lien_action"]');
    const who = action.text();
    const url = `${buildURL(action.attr('href') as string)}`;
    const what = $('.ak-title').text().includes('uniu') ? 'ENTROU' : 'SAIU';

    if (who) {
      events.push({
        who,
        when,
        what,
        url,
      });
    }
  });
  return events;
}

async function getPartner(events: User[], page: Page) {
  const eventsWithPartner = [];
  for (let i = 0; i < events.length; i += 1) {
    let partner = undefined;
    const event = events[i];
    const content = await getContent(page, event.url);
    const $ = load(content);
    const spousename = $('.ak-infos-spousename');
    if (spousename.text()) {
      partner = {
        name: spousename.text(),
        url: buildURL(`/pt/mmorpg/comunidade/anuarios/paginas-personagens/${spousename.attr('href')}`),
      };
    }
    eventsWithPartner.push({
      ...event,
      partner,
    });
  }
  return eventsWithPartner;
}

async function main() {
  const browser: Browser = await launch();
  try {
    const page: Page = await browser.newPage();
    for (let index = 0; index < guilds.length; index++) {
      const { fileName, url } = guilds[index];
      const events: User[] = await getEvents(page, url);
      const eventsWithPartner: User[] = await getPartner(events, page);
      writeFileSync(join(homedir(), 'Desktop', fileName), JSON.stringify(eventsWithPartner));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

(async () => await main())();
