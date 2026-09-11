import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StageAuthorityError } from '@/lib/hr/recruitment/stage-authority-error';
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/lib/hr/recruitment/stage-access', () => ({ requireRecruitmentRead: mocks.read }));
vi.mock('@/app/admin/applications/[id]/RecruitmentDetail', () => ({ default: () => <div>Private applicant details</div> }));
import Page from '@/app/hr/recruitment/[id]/page';
const props = { params: Promise.resolve({ id: 'app' }), searchParams: Promise.resolve({}) };
describe('removed hiring-team member page', () => {
  beforeEach(() => vi.resetAllMocks());
  it('shows safe access feedback without rendering applicant details or links', async () => {
    mocks.read.mockRejectedValue(new StageAuthorityError('scope lost'));
    const html = renderToStaticMarkup(await Page(props));
    expect(html).toContain('role="alert"');
    expect(html).toContain('membership or assignment may have changed');
    expect(html).not.toContain('Private applicant details');
    expect(html).not.toContain('/app/tools');
  });
  it('preserves eligible rendering', async () => {
    mocks.read.mockResolvedValue({});
    expect(renderToStaticMarkup(await Page(props))).toContain('Private applicant details');
  });
  it('preserves authentication redirects and unexpected errors', async () => {
    const error = new Error('NEXT_REDIRECT'); mocks.read.mockRejectedValue(error);
    await expect(Page(props)).rejects.toBe(error);
  });
});
