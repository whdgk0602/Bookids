import type { Metadata } from "next";
import Bookshelf from "./bookshelf";

export const metadata: Metadata = { title: "그림책 책장 · Bookids" };

export default function LibraryPage() {
  return <Bookshelf />;
}
