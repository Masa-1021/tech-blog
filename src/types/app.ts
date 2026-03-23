export type AppStatus = "active" | "coming-soon";
export type AppNetwork = "external" | "internal";
export type AppCategory = "収集" | "見える化" | "活用" | "共有・管理";

export interface AppFrontmatter {
  title: string;
  subtitle: string;
  description: string;
  category: AppCategory;
  level: number | null;
  status: AppStatus;
  appUrl: string | null;
  network: AppNetwork;
  icon: string;
  banner: string;
  date: string;
}

export interface App extends AppFrontmatter {
  slug: string;
  content: string;
}
