# Pork and Garlic Ice Cream Year 2 Decision Tool

A small browser-based financial decision tool for the Year 2 winter home assignment. It compares two editable strategies from the same Year 1 closing position and applies the official Year 1 accounting rules as editable Year 2 estimates.

## What it covers

- Editable Year 1 closing cash, annual profit, machine lives, unpaid loans and tax losses
- Two side-by-side winter plans with premises, production, milk, sales requests, trainer allocations, market investment, machine use and borrowing
- Profit and loss with depreciation, maintenance, transport, bonus, interest and game tax
- Cash timing checks before advance payments and at season end
- Spoilage, machine capacity, milk yield, debt-limit and loan-term validations
- Dynamic plan differences, a recommendation, the main sales assumption and a 20% downside view
- Editable premise, machine, market and finance estimates for rules that are not yet confirmed for Year 2
- The official Year 1 worked example, reconciled to a Sh 3,560 loss and Sh 71,940 closing cash

## Run locally

The app has no runtime dependencies. Serve this folder with any static server, for example:

```bash
python -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

## Test the calculations

```bash
npm test
```

The inputs are saved in local browser storage. Use **Reset the example data** in the footer to restore the starting scenarios.
