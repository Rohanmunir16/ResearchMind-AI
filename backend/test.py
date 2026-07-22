import arxiv

client = arxiv.Client()

search = arxiv.Search(
    query="artificial intelligence",
    max_results=5,
    sort_by=arxiv.SortCriterion.Relevance,
)

for paper in client.results(search):
    print(paper.title)