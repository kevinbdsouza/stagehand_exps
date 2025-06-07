import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { z } from "zod";

/**
 * 🤘 Welcome to Stagehand! Thanks so much for trying us out!
 * 🛠️ CONFIGURATION: stagehand.config.ts will help you configure Stagehand
 *
 * 📝 Check out our docs for more fun use cases, like building agents
 * https://docs.stagehand.dev/
 *
 * 💬 If you have any feedback, reach out to us on Slack!
 * https://stagehand.dev/slack
 *
 * 📚 You might also benefit from the docs for Zod, Browserbase, and Playwright:
 * - https://zod.dev/
 * - https://docs.browserbase.com/
 * - https://playwright.dev/docs/intro
 */
async function main({
  page,
  context,
  stagehand,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
}) {
  // Navigate to Google Flights
  await page.goto("https://www.google.com/travel/flights?hl=en");

  // Search for the required flights
  await page.act(
    "Search for flights from Toronto to Bangalore departing between September 27 and October 2 with no more than 2 layovers",
  );

  // Apply filters for layover time and total duration, then sort by lowest price
  await page.act(
    "Filter results so each layover is under 5 hours and total travel time is under 30 hours, then sort results by price",
  );

  const { flights } = await page.extract({
    instruction:
      "Extract each flight option shown including airline names, price, total travel time, number of layovers, layover durations, and departure date",
    schema: z.object({
      flights: z.array(
        z.object({
          airlines: z.string(),
          price: z.string(),
          totalDuration: z.string(),
          stops: z.number(),
          layovers: z.array(z.string()).optional(),
          departureDate: z.string(),
        }),
      ),
    }),
  });

  const parsed = flights
    .map((f) => ({
      ...f,
      numericPrice: parseFloat(f.price.replace(/[^0-9.]/g, "")),
    }))
    .sort((a, b) => a.numericPrice - b.numericPrice);

  console.log(boxen(JSON.stringify(parsed, null, 2), { title: "Flights", padding: 1 }));

  stagehand.log({
    category: "flight-search",
    message: `Retrieved ${parsed.length} flights`,
    auxiliary: {
      flights: {
        value: JSON.stringify(parsed),
        type: "object",
      },
    },
  });
}

/**
 * This is the main function that runs when you do npm run start
 *
 * YOU PROBABLY DON'T NEED TO MODIFY ANYTHING BELOW THIS POINT!
 *
 */
async function run() {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;
  await main({
    page,
    context,
    stagehand,
  });
  await stagehand.close();
  console.log(
    `\n🤘 Thanks so much for using Stagehand! Reach out to us on Slack if you have any feedback: ${chalk.blue(
      "https://stagehand.dev/slack",
    )}\n`,
  );
}

run();
