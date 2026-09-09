import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import List from '../src/app/admin/applications/page';
import Detail from '../src/app/admin/applications/[id]/page';
import Archive from '../src/app/admin/applications/deleted/page';
import Diagnostics from '../src/app/admin/tracking-diagnostics/page';
import { recruitmentEntryUrl } from '../src/lib/hr/recruitment/legacy-entry';

describe('single HRMS recruitment entry', () => {
  it.each([
    [List, '/hr/recruitment/oversight'], [Archive, '/hr/recruitment/archive'],
    [Diagnostics, '/hr/recruitment/diagnostics'],
  ] as const)('redirects legacy entry without rendering a competing workspace', async (Page, target) => {
    await expect(Page({ searchParams: Promise.resolve({ success: 'saved', stage: '8' }) })).rejects.toThrow(`REDIRECT:${target}?success=saved&stage=8`);
  });
  it('preserves the application identity and safely encodes its path', async () => {
    await expect(Detail({ params: Promise.resolve({ id: 'test/id' }), searchParams: Promise.resolve({ warning: 'email_failed' }) })).rejects.toThrow('REDIRECT:/hr/recruitment/test%2Fid?warning=email_failed');
  });
  it('does not let query parameters replace the fixed internal destination', () => {
    expect(recruitmentEntryUrl('/hr/recruitment/oversight', { next: 'https://outside.test', tag: ['a', 'b'], empty: undefined })).toBe('/hr/recruitment/oversight?next=https%3A%2F%2Foutside.test&tag=a&tag=b');
  });
  it('keeps scoped authorization and avoids redirect loops in canonical renderers', () => {
    const detail = readFileSync('src/app/hr/recruitment/[id]/page.tsx', 'utf8');
    expect(detail).toContain('await requireRecruitmentRead(id)');
    expect(detail).toContain('/RecruitmentDetail');
    for (const [route, renderer] of [['oversight', 'RecruitmentList'], ['archive', 'RecruitmentArchive'], ['diagnostics', 'RecruitmentDiagnostics']]) {
      expect(readFileSync(`src/app/hr/recruitment/${route}/page.tsx`, 'utf8')).toContain(renderer);
    }
    for (const file of ['src/app/admin/applications/RecruitmentList.tsx', 'src/app/admin/applications/deleted/RecruitmentArchive.tsx', 'src/app/admin/tracking-diagnostics/RecruitmentDiagnostics.tsx']) {
      expect(readFileSync(file, 'utf8')).toContain('await recruitmentOversight()');
    }
  });
});
