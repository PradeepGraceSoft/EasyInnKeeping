// fixtures.ts
import { test as base } from "@playwright/test";
import { faker } from "@faker-js/faker";

type TestFixtures = {
  fakeData: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    phoneNumber: string;
    groupName: string;
  };
};

export const test = base.extend<TestFixtures>({
  fakeData: async ({}, use) => {
    const fakeData = {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      country: faker.location.country(),
      zipCode: faker.location.zipCode(),
      phoneNumber: faker.phone.number(),
      groupName: faker.company.name(),
    };
    await use(fakeData);
  },
});

export { expect } from "@playwright/test";
