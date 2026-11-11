// Phosphor icons (MIT), inlined as SVG so the same markup serves React and the map's HTML strings.
// Each SVG fills with currentColor, so an icon takes the colour of the text around it.
// Weights follow the stroke to the type: bold at 14-16px, regular at 20px, light at 32px, fill in map pins.
import CoffeeBold from "@phosphor-icons/core/assets/bold/coffee-bold.svg?raw";
import CoffeeRegular from "@phosphor-icons/core/assets/regular/coffee.svg?raw";
import CoffeeFill from "@phosphor-icons/core/assets/fill/coffee-fill.svg?raw";
import BooksBold from "@phosphor-icons/core/assets/bold/books-bold.svg?raw";
import BooksRegular from "@phosphor-icons/core/assets/regular/books.svg?raw";
import BooksFill from "@phosphor-icons/core/assets/fill/books-fill.svg?raw";
import BriefcaseBold from "@phosphor-icons/core/assets/bold/briefcase-bold.svg?raw";
import BriefcaseRegular from "@phosphor-icons/core/assets/regular/briefcase.svg?raw";
import BriefcaseFill from "@phosphor-icons/core/assets/fill/briefcase-fill.svg?raw";
import TreeBold from "@phosphor-icons/core/assets/bold/tree-bold.svg?raw";
import TreeRegular from "@phosphor-icons/core/assets/regular/tree.svg?raw";
import TreeFill from "@phosphor-icons/core/assets/fill/tree-fill.svg?raw";
import WineBold from "@phosphor-icons/core/assets/bold/wine-bold.svg?raw";
import WineRegular from "@phosphor-icons/core/assets/regular/wine.svg?raw";
import WineFill from "@phosphor-icons/core/assets/fill/wine-fill.svg?raw";
import ForkKnifeBold from "@phosphor-icons/core/assets/bold/fork-knife-bold.svg?raw";
import ForkKnifeRegular from "@phosphor-icons/core/assets/regular/fork-knife.svg?raw";
import ForkKnifeFill from "@phosphor-icons/core/assets/fill/fork-knife-fill.svg?raw";
import BankBold from "@phosphor-icons/core/assets/bold/bank-bold.svg?raw";
import BankRegular from "@phosphor-icons/core/assets/regular/bank.svg?raw";
import BankFill from "@phosphor-icons/core/assets/fill/bank-fill.svg?raw";
import BookOpenBold from "@phosphor-icons/core/assets/bold/book-open-bold.svg?raw";
import BookOpenRegular from "@phosphor-icons/core/assets/regular/book-open.svg?raw";
import BookOpenFill from "@phosphor-icons/core/assets/fill/book-open-fill.svg?raw";
import HammerBold from "@phosphor-icons/core/assets/bold/hammer-bold.svg?raw";
import HammerRegular from "@phosphor-icons/core/assets/regular/hammer.svg?raw";
import HammerFill from "@phosphor-icons/core/assets/fill/hammer-fill.svg?raw";
import BedBold from "@phosphor-icons/core/assets/bold/bed-bold.svg?raw";
import BedRegular from "@phosphor-icons/core/assets/regular/bed.svg?raw";
import BedFill from "@phosphor-icons/core/assets/fill/bed-fill.svg?raw";
import UsersThreeRegular from "@phosphor-icons/core/assets/regular/users-three.svg?raw";
import UsersThreeFill from "@phosphor-icons/core/assets/fill/users-three-fill.svg?raw";
import TicketBold from "@phosphor-icons/core/assets/bold/ticket-bold.svg?raw";
import UsersBold from "@phosphor-icons/core/assets/bold/users-bold.svg?raw";
import UsersRegular from "@phosphor-icons/core/assets/regular/users.svg?raw";
import UsersFill from "@phosphor-icons/core/assets/fill/users-fill.svg?raw";
import MapPinBold from "@phosphor-icons/core/assets/bold/map-pin-bold.svg?raw";
import MapPinFill from "@phosphor-icons/core/assets/fill/map-pin-fill.svg?raw";
import PlusBold from "@phosphor-icons/core/assets/bold/plus-bold.svg?raw";
import UsersThreeBold from "@phosphor-icons/core/assets/bold/users-three-bold.svg?raw";
import MapTrifoldLight from "@phosphor-icons/core/assets/light/map-trifold-light.svg?raw";
import MapTrifoldBold from "@phosphor-icons/core/assets/bold/map-trifold-bold.svg?raw";
import MagnifyingGlassBold from "@phosphor-icons/core/assets/bold/magnifying-glass-bold.svg?raw";
import MinusBold from "@phosphor-icons/core/assets/bold/minus-bold.svg?raw";
import CrosshairBold from "@phosphor-icons/core/assets/bold/crosshair-bold.svg?raw";
import ArrowLeftBold from "@phosphor-icons/core/assets/bold/arrow-left-bold.svg?raw";
import XBold from "@phosphor-icons/core/assets/bold/x-bold.svg?raw";
import CopyBold from "@phosphor-icons/core/assets/bold/copy-bold.svg?raw";
import GlobeBold from "@phosphor-icons/core/assets/bold/globe-bold.svg?raw";
import PencilSimpleBold from "@phosphor-icons/core/assets/bold/pencil-simple-bold.svg?raw";
import FlagBold from "@phosphor-icons/core/assets/bold/flag-bold.svg?raw";
import TrashBold from "@phosphor-icons/core/assets/bold/trash-bold.svg?raw";
import AppleLogoBold from "@phosphor-icons/core/assets/bold/apple-logo-bold.svg?raw";
import NotePencilBold from "@phosphor-icons/core/assets/bold/note-pencil-bold.svg?raw";
import ArrowUpBold from "@phosphor-icons/core/assets/bold/arrow-up-bold.svg?raw";
import ArrowRightBold from "@phosphor-icons/core/assets/bold/arrow-right-bold.svg?raw";
import CheckBold from "@phosphor-icons/core/assets/bold/check-bold.svg?raw";
import CircleNotchBold from "@phosphor-icons/core/assets/bold/circle-notch-bold.svg?raw";
import ClockBold from "@phosphor-icons/core/assets/bold/clock-bold.svg?raw";
import SunBold from "@phosphor-icons/core/assets/bold/sun-bold.svg?raw";
import MoonBold from "@phosphor-icons/core/assets/bold/moon-bold.svg?raw";
import RowsBold from "@phosphor-icons/core/assets/bold/rows-bold.svg?raw";

import type { IconName, IconWeight } from "./icon-names";

export type { IconName, IconWeight };

const SVGS: Partial<Record<`${IconName}/${IconWeight}`, string>> = {
  "coffee/bold": CoffeeBold,
  "coffee/regular": CoffeeRegular,
  "coffee/fill": CoffeeFill,
  "books/bold": BooksBold,
  "books/regular": BooksRegular,
  "books/fill": BooksFill,
  "briefcase/bold": BriefcaseBold,
  "briefcase/regular": BriefcaseRegular,
  "briefcase/fill": BriefcaseFill,
  "tree/bold": TreeBold,
  "tree/regular": TreeRegular,
  "tree/fill": TreeFill,
  "wine/bold": WineBold,
  "wine/regular": WineRegular,
  "wine/fill": WineFill,
  "fork-knife/bold": ForkKnifeBold,
  "fork-knife/regular": ForkKnifeRegular,
  "fork-knife/fill": ForkKnifeFill,
  "bank/bold": BankBold,
  "bank/regular": BankRegular,
  "bank/fill": BankFill,
  "book-open/bold": BookOpenBold,
  "book-open/regular": BookOpenRegular,
  "book-open/fill": BookOpenFill,
  "hammer/bold": HammerBold,
  "hammer/regular": HammerRegular,
  "hammer/fill": HammerFill,
  "bed/bold": BedBold,
  "bed/regular": BedRegular,
  "bed/fill": BedFill,
  "users-three/regular": UsersThreeRegular,
  "users-three/fill": UsersThreeFill,
  "ticket/bold": TicketBold,
  "users/bold": UsersBold,
  "users/regular": UsersRegular,
  "users/fill": UsersFill,
  "map-pin/bold": MapPinBold,
  "map-pin/fill": MapPinFill,
  "plus/bold": PlusBold,
  "users-three/bold": UsersThreeBold,
  "map-trifold/light": MapTrifoldLight,
  "map-trifold/bold": MapTrifoldBold,
  "rows/bold": RowsBold,
  "sun/bold": SunBold,
  "moon/bold": MoonBold,
  "clock/bold": ClockBold,
  "note-pencil/bold": NotePencilBold,
  "arrow-up/bold": ArrowUpBold,
  "arrow-right/bold": ArrowRightBold,
  "check/bold": CheckBold,
  "circle-notch/bold": CircleNotchBold,
  "arrow-left/bold": ArrowLeftBold,
  "x/bold": XBold,
  "copy/bold": CopyBold,
  "globe/bold": GlobeBold,
  "pencil-simple/bold": PencilSimpleBold,
  "flag/bold": FlagBold,
  "trash/bold": TrashBold,
  "apple-logo/bold": AppleLogoBold,
  "minus/bold": MinusBold,
  "crosshair/bold": CrosshairBold,
  "magnifying-glass/bold": MagnifyingGlassBold,
};

export function iconSvg(name: IconName, weight: IconWeight = "regular", size = 16): string {
  const svg = SVGS[`${name}/${weight}`];
  if (!svg) throw new Error(`Phosphor icon ${name} (${weight}) is not imported in lib/icons.ts`);
  return svg.replace("<svg ", `<svg width="${size}" height="${size}" aria-hidden="true" focusable="false" `);
}
