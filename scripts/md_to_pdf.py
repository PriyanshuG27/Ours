from markdown_pdf import MarkdownPdf, Section

try:
    print('Generating PDF from markdown...')
    pdf = MarkdownPdf(toc_level=2)
    pdf.add_section(Section(open('docs/production-deployment-guide.md', encoding='utf-8').read(), toc=False))
    pdf.save('docs/production-deployment-guide.pdf')
    print('PDF generated successfully at docs/production-deployment-guide.pdf')
except Exception as e:
    print(f'Error generating PDF: {e}')
