'use server';
import { redirect } from 'next/navigation';
export async function adminLoginAction(_formData: FormData) { redirect('/hr/login'); }
