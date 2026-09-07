# Testing

Run `npm run test:antinuke`, `npm run test:antinuke:concurrency`, `npm run test:antinuke:fuzz`, and `npm run test:antinuke:coverage`. Critical tests assert full decision reasons and forbidden mutations, not only mock calls. Fuzz failures must retain the reported fast-check seed.

The authored fuzz suite uses 5,000 sequences. Coverage and pass results must not be claimed until dependencies are installed and commands complete successfully.
