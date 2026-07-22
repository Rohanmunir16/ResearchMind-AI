import arxiv

client = arxiv.Client()


def search_papers(topic, max_results=10):

    papers = []

    search = arxiv.Search(
        query=topic,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance,
    )

    for result in client.results(search):

        papers.append({

            "title": result.title,

            "authors": [author.name for author in result.authors],

            "published": str(result.published.date()),

            "summary": result.summary,

            "pdf": result.pdf_url,

        })

    return papers