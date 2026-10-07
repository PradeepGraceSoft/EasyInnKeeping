import { test, expect } from "../../../src/fixtures/sso.fixture";
import { Logger } from "../../../src/utils/Logger";

const vrboConfiguration = {
  propertyId: 1885,
  roomType: "1 King Bed Room - Heart Lake",
  roomCode: "18851KIN24",
  roomId: 222,
};

const minimumPriorNotifyScenarios = [
  { value: 0, behavior: "accept same-day bookings" },
  { value: 3, behavior: "require three days prior notice" },
];

test.describe("Vrbo same-day booking availability", () => {
  test.describe.configure({ mode: "serial" });

  for (const { value, behavior } of minimumPriorNotifyScenarios) {
    test(`minimumPriorNotify ${value} should ${behavior} in the availability XML`, async ({
      otaDb,
    }, testInfo) => {
      await test.step(`Configure minimumPriorNotify as ${value}`, async () => {
        await otaDb.setVrboMinimumPriorNotify(
          vrboConfiguration.propertyId,
          vrboConfiguration.roomType,
          value,
        );
        Logger.info(
          `[Vrbo checkpoint] Configured property ${vrboConfiguration.propertyId}, room type "${vrboConfiguration.roomType}" with minimumPriorNotify=${value}`,
        );
      });

      const databaseValue = await test.step(
        "Verify the saved database value",
        async () => {
          const savedValue = await otaDb.getVrboMinimumPriorNotify(
            vrboConfiguration.propertyId,
            vrboConfiguration.roomType,
          );
          Logger.info(
            `[Vrbo checkpoint] Database minimumPriorNotify=${savedValue}; expected=${value}`,
          );
          return savedValue;
        },
      );
      expect(databaseValue).toBe(value);

      const availabilityXml = await test.step(
        "Execute the Vrbo availability procedure",
        async () => {
          const xml = await otaDb.getVrboAvailabilityXml(
            vrboConfiguration.propertyId,
            vrboConfiguration.roomCode,
            vrboConfiguration.roomId,
          );
          if (Logger.isEnabled()) {
            await testInfo.attach(`vrbo-availability-minPriorNotify-${value}.xml`, {
              body: Buffer.from(xml),
              contentType: "application/xml",
            });
          }
          Logger.info(
            `[Vrbo checkpoint] Availability XML retrieved and attached for room ${vrboConfiguration.roomCode}/${vrboConfiguration.roomId}`,
          );
          return xml;
        },
      );

      await test.step("Verify minimumPriorNotifyDefault in the XML", async () => {
        const minimumPriorNotifyMatch = availabilityXml.match(
          /<(?:[\w-]+:)?minPriorNotifyDefault\b[^>]*>\s*(\d+)\s*<\/(?:[\w-]+:)?minPriorNotifyDefault>/i,
        );
        const xmlValue = minimumPriorNotifyMatch?.[1];

        Logger.info(
          `[Vrbo checkpoint] XML minPriorNotifyDefault=${xmlValue ?? "missing"}; expected=${value}`,
        );
        if (Logger.isEnabled()) {
          await testInfo.attach("verification-values.json", {
            body: Buffer.from(
              JSON.stringify(
                {
                  propertyId: vrboConfiguration.propertyId,
                  roomType: vrboConfiguration.roomType,
                  roomCode: vrboConfiguration.roomCode,
                  roomId: vrboConfiguration.roomId,
                  configuredValue: value,
                  databaseValue,
                  xmlValue: xmlValue === undefined ? null : Number(xmlValue),
                },
                null,
                2,
              ),
            ),
            contentType: "application/json",
          });
        }

        expect(
          minimumPriorNotifyMatch,
          `Expected the Vrbo availability XML to contain minPriorNotifyDefault. XML: ${availabilityXml.slice(0, 1_000)}`,
        ).not.toBeNull();
        expect(Number(xmlValue)).toBe(value);
      });
    });
  }

  test("empty minimumPriorNotify should omit minPriorNotifyDefault from the availability XML", async ({
    otaDb,
  }, testInfo) => {
    await test.step("Clear minimumPriorNotify", async () => {
      await otaDb.setVrboMinimumPriorNotify(
        vrboConfiguration.propertyId,
        vrboConfiguration.roomType,
        null,
      );
    });

    const databaseValue = await test.step(
      "Verify the saved database value is empty",
      async () =>
        otaDb.getVrboMinimumPriorNotify(
          vrboConfiguration.propertyId,
          vrboConfiguration.roomType,
        ),
    );
    expect(databaseValue).toBeNull();

    const availabilityXml = await test.step(
      "Execute the Vrbo availability procedure",
      async () => {
        const xml = await otaDb.getVrboAvailabilityXml(
          vrboConfiguration.propertyId,
          vrboConfiguration.roomCode,
          vrboConfiguration.roomId,
        );
        if (Logger.isEnabled()) {
          await testInfo.attach("vrbo-availability-minPriorNotify-empty.xml", {
            body: Buffer.from(xml),
            contentType: "application/xml",
          });
        }
        return xml;
      },
    );

    await test.step("Verify minPriorNotifyDefault is omitted from the XML", async () => {
      expect(
        availabilityXml,
        `Expected the Vrbo availability XML to omit minPriorNotifyDefault. XML: ${availabilityXml.slice(0, 1_000)}`,
      ).not.toMatch(/<(?:[\w-]+:)?minPriorNotifyDefault\b/i);
    });
  });
});
