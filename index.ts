import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { z } from "zod";

type RawFlight = {
  airlines: string;
  price: string;
  totalDuration: string;
  stops: number;
  layovers?: string[];
};

function parseDuration(duration: string): number {
  const hMatch = duration.match(/(\d+)\s*h/);
  const mMatch = duration.match(/(\d+)\s*m/);
  const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0;
  return hours * 60 + minutes;
}

function parseFlight(flight: RawFlight) {
  return {
    ...flight,
    numericPrice: parseFloat(flight.price.replace(/[^0-9.]/g, "")),
    totalMinutes: parseDuration(flight.totalDuration),
    layoverMinutes: (flight.layovers || []).map((l) => parseDuration(l)),
  };
}

function isValidFlight(flight: ReturnType<typeof parseFlight>) {
  const maxLayover = 5 * 60;
  return (
    flight.stops <= 2 &&
    flight.totalMinutes <= 30 * 60 &&
    flight.layoverMinutes.every((l) => l <= maxLayover)
  );
}

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
  const startDate = new Date("2024-09-27");
  const endDate = new Date("2024-10-02");

  const allFlights: (ReturnType<typeof parseFlight> & { departureDate: string })[] = [];

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    const iso = d.toISOString().split("T")[0];
    const url =
      `https://www.google.com/travel/flights?hl=en&q=Flights%20from%20Toronto%20to%20Bangalore%20on%20${iso}`;

    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.waitForSelector('div[role="listitem"]', { timeout: 30000 });

    const { flights } = await page.extract({
      instruction:
        "Extract up to 10 flight options shown including airline names, price, total travel time, number of layovers, layover durations",
      schema: z.object({
        flights: z.array(
          z.object({
            airlines: z.string(),
            price: z.string(),
            totalDuration: z.string(),
            stops: z.number(),
            layovers: z.array(z.string()).optional(),
          }),
        ),
      }),
    });

    flights.forEach((f) => {
      const parsed = parseFlight(f);
      if (isValidFlight(parsed)) {
        allFlights.push({ ...parsed, departureDate: iso });
      }
    });
  }

  allFlights.sort((a, b) => a.numericPrice - b.numericPrice);

  console.log(
    boxen(JSON.stringify(allFlights, null, 2), { title: "Flights", padding: 1 })
  );

  stagehand.log({
    category: "flight-search",
    message: `Retrieved ${allFlights.length} flights`,
    auxiliary: {
      flights: {
        value: JSON.stringify(allFlights),
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
