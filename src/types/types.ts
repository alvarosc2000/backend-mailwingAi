export type GmailFromFilter =
  | string
  | {
      operator: "equals" | "ends_with" | "contains";
      value: string;
    };

export interface GmailNewEmailTrigger {
  type: "gmail.new_email";
  from?: GmailFromFilter;
}
