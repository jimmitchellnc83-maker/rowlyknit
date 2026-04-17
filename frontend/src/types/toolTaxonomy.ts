export interface ToolTaxonomySuggestion {
  toolTypeId: string;
  label: string;
  subcategoryId: string;
  subcategoryLabel: string;
  categoryId: string;
  categoryLabel: string;
  appliesTo: string[];
  score?: number;
  source?: 'recent' | 'popular';
}

export interface TaxonomyToolType {
  id: string;
  label: string;
  appliesTo: string[];
  keywords: string[]; // specific kinds within this type, e.g. "umbrella swift", "tabletop swift"
}

export interface TaxonomySubcategory {
  id: string;
  label: string;
  toolTypes: TaxonomyToolType[];
}

export interface TaxonomyCategory {
  id: string;
  label: string;
  subcategories: TaxonomySubcategory[];
}

export type ToolTaxonomyTree = TaxonomyCategory[];
