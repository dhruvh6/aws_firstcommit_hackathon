/**
 * Footer - docs/06-UI-SPEC.md § 3. Product line, category shortcuts, and
 * the synthetic-data disclaimer.
 * OWNER: M1.
 */
import { Link } from 'react-router-dom';
import { label, MATERIAL_CATEGORIES } from '@dse/shared';

const CATEGORY_LINKS = MATERIAL_CATEGORIES.map((code) => ({
  code,
  label: label('category', code) ?? code,
}));

export function Footer(): React.JSX.Element {
  return (
    <footer className="bg-footer text-white">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-6 py-8 text-[13px]">
        <p className="text-[14px] font-semibold text-white">
          DeadStock Exchange - B2B circular material exchange for industrial surplus
        </p>

        <nav aria-label="Categories" className="flex flex-wrap gap-4">
          {CATEGORY_LINKS.map((category) => (
            <Link
              key={category.code}
              to={`/browse?category=${category.code}`}
              className="text-brand-100 hover:text-white hover:underline"
            >
              {category.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-4 text-brand-100">
          <span>Built for First Commit 2026 - Ship It</span>
          <a
            href="https://github.com/dhruvh6/aws_firstcommit_hackathon"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white hover:underline"
          >
            View the repository
          </a>
        </div>

        <p className="text-brand-100">Demo data only. Businesses and listings are synthetic.</p>
      </div>
    </footer>
  );
}
