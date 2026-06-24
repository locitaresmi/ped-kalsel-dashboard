import { formatDefaultLocale } from "d3-format";

formatDefaultLocale({
  decimal: ",",
  thousands: ".",
  grouping: [3],
  currency: ["Rp", ""],
  minus: "-",
});
