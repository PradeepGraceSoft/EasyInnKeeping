import { faker } from "@faker-js/faker";

export class TestDataGenerator {
  static firstName(): string {
    return faker.person.firstName();
  }

  static lastName(): string {
    return faker.person.lastName();
  }

  static address(): string {
    return faker.location.streetAddress().replace(/[\u0027\u2019]/g, "");
  }

  static city(): string {
    return faker.location.city();
  }

  static state(): string {
    return faker.location.state();
  }

  static country(): string {
    return faker.location.country();
  }

  static zipCode(): string {
    return faker.location.zipCode();
  }

  static phoneNumber(): string {
    return faker.string.numeric(10);
  }

  static email(firstName?: string, lastName?: string): string {
    const initials = [firstName, lastName]
      .filter(Boolean)
      .map((name) => name![0])
      .join("")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "t";
    const uniqueId = `${Date.now().toString(36)}${faker.string.alphanumeric(4).toLowerCase()}`;

    return `tester1gracesoft+${initials}${uniqueId}@gmail.com`;
  }

  static companyName(): string {
    return faker.company.name();
  }

  static notes(): string {
    return faker.lorem.sentence();
  }

  static groupName(): string {
    return `Group-${faker.company.name()}`;
  }
}
