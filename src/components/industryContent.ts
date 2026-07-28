export type IndustryContent = {
  title: string;
  description: string;
};

export const INDUSTRY_CONTENT: readonly IndustryContent[] = [
  { title: 'Financial Services', description: 'High-volume transactions, sensitive records, auditability, and regulatory review require controlled access and traceable decisions. We prioritize resilient workflows, governance, and accurate reporting.' },
  { title: 'Healthcare', description: 'Clinical and administrative users need timely information without weakening privacy or continuity of care. We design around role-based access, interoperability, and dependable service delivery.' },
  { title: 'Retail & E-commerce', description: 'Customers expect simple purchasing while operators need accurate inventory, fulfilment, and performance data. We connect these workflows to reduce friction and improve visibility.' },
  { title: 'Manufacturing', description: 'Production environments depend on uptime, safety, equipment constraints, and usable shop-floor workflows. We introduce changes in stages and measure throughput, quality, and disruption.' },
  { title: 'Education', description: 'Learners, educators, administrators, and guardians have different access and accessibility needs. We simplify learning and administrative tasks while respecting institutional governance.' },
  { title: 'Government & Public Sector', description: 'Public services require accessibility, accountability, procurement discipline, and continuity across varied users. We emphasize transparent workflows, maintainable delivery, and responsible data handling.' },
  { title: 'Technology & SaaS', description: 'Digital product teams balance release speed with reliability, tenant boundaries, and operating cost. We strengthen product delivery, platform observability, and maintainable growth.' },
  { title: 'Real Estate', description: 'Property teams coordinate listings, documents, payments, maintenance, and many stakeholders. We create clearer workflows and a dependable view of operational information.' },
  { title: 'Energy & Utilities', description: 'Asset-heavy operations require continuity, field usability, monitoring, and careful change control. We design for dependable information flow and decisions that improve efficiency and resilience.' },
  { title: 'Logistics & Transportation', description: 'Time-sensitive movement involves dispatchers, drivers, partners, and customers working across changing conditions. We improve coordination, exception handling, and shipment visibility.' },
  { title: 'Media, Creators & Personal Brands', description: 'Publishing teams need accessible experiences, efficient content operations, ownership of audience data, and sustainable performance. We build around those workflows rather than vanity metrics.' },
  { title: 'Professional Services', description: 'Client work depends on clear handoffs, permissions, deadlines, and trusted records. We streamline delivery and reporting while keeping professional judgment and accountability visible.' },
];
