import { NewspaperViewer } from '@/components/features/newspaper/NewspaperViewer';

export const metadata = {
  title: 'Newspaper - Ours',
};

export default function NewspaperPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">The Sunday Paper</h1>
        <p className="text-muted-foreground mt-2">
          Your weekly relationship digest, generated every Sunday morning.
        </p>
      </div>
      
      <NewspaperViewer />
    </div>
  );
}
