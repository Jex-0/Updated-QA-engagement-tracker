/** jsdom has no object-URL implementation; downloads only need the calls to exist. */
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:jsdom";
  URL.revokeObjectURL = () => {};
}
