// =============================================================================
// NEAR REAL-TIME WATER QUALITY MONITORING
// Parameter  : pH (dimensionless)
// Model      : Random Forest (smileRandomForest, 100 trees)
// Output     : Monthly mean maps — Chao Phraya & Khlong Nueng (2024)
// Indices    : NIR, B3_B5  [+ in-situ TDS, Turbidity as hybrid features]
// Assets     : pHCombined | tdsCombined | turbidityCombined | Chao_Phraya | Khlong_Nueng
// =============================================================================

// Study area polygon
var Pathum_Thani = ee.Geometry.Polygon([
  [[100.49344515247942, 13.911774187300836],
   [100.78595613880755, 13.911774187300836],
   [100.78595613880755, 14.135610659931288],
   [100.49344515247942, 14.135610659931288],
   [100.49344515247942, 13.911774187300836]]
]);

// Selected Dates for training/validation/testing
var selectedDateList = ['2024-06-21', '2024-06-29', '2024-07-07', '2024-07-15',
                      '2024-07-23', '2024-07-31', '2024-08-08', '2024-08-16',
                      '2024-08-24', '2024-09-01', '2024-09-09', '2024-09-17',
                      '2024-10-19', '2024-10-27', '2024-11-04', '2024-11-12',
                      '2024-11-20', '2024-11-28', '2024-12-06', '2024-12-22',
                      '2024-12-30', '2025-01-07'];

// Combined sampling points for all zones
var samplingPoints = ee.FeatureCollection([
  // Zone 1
  ee.Feature(ee.Geometry.Point([100.620189, 14.082205]), {
    Zone: 1, Station: 'Talad Thai Pt1'
  }),
  ee.Feature(ee.Geometry.Point([100.620189, 14.081055]), {
    Zone: 1, Station: 'Talad Thai Pt2'
  }),
  ee.Feature(ee.Geometry.Point([100.620228, 14.077457]), {
    Zone: 1, Station: 'Talad Thai Pt3'
  }),
  // Zone 2
  ee.Feature(ee.Geometry.Point([100.560725, 14.038922]), {
    Zone: 2, Station: 'Khlong Bang Luang Pt1'
  }),
  ee.Feature(ee.Geometry.Point([100.554583, 14.040492]), {
    Zone: 2, Station: 'Khlong Bang Luang Pt2'
  }),
  ee.Feature(ee.Geometry.Point([100.557736, 14.039386]), {
    Zone: 2, Station: 'Khlong Bang Luang Pt3'
  }),
  ee.Feature(ee.Geometry.Point([100.557125, 14.040869]), {
    Zone: 2, Station: 'Khlong Bang Luang Pt4'
  }),
  // Zone 3
  ee.Feature(ee.Geometry.Point([100.5585, 14.0534]), {
    Zone: 3, Station: 'Ban Phrao Pt1'
  }),
  ee.Feature(ee.Geometry.Point([100.5557, 14.05214]), {
    Zone: 3, Station: 'Ban Phrao Pt2'
  }),
  ee.Feature(ee.Geometry.Point([100.5553, 14.05188]), {
    Zone: 3, Station: 'Ban Phrao Pt3'
  }),
  ee.Feature(ee.Geometry.Point([100.5542, 14.05183]), {
    Zone: 3, Station: 'Ban Phrao Pt4'
  })
]);

// Spectral indices calculation for pH
function calculateIndices(image) {
  var NIR = image.select('SR_B5').rename('NIR');
  var B3_B5 = image.select('SR_B3').add(image.select('SR_B5')).rename('B3_B5');
  return image.addBands([NIR, B3_B5]);
}

// Optimized filtered collection function
function getFilteredCollection(collection, dates) {
  return ee.ImageCollection.fromImages(
    dates.map(function(date) {
      var dateObj = ee.Date(date);
      return collection
        .filterDate(dateObj.advance(-1, 'day'), dateObj.advance(1, 'day'))
        .mean()
        .set('system:time_start', dateObj.millis())
        .set('date', dateObj);
    })
  );
}

// Define landsatCollection
var landsatCollection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
  .filterBounds(Pathum_Thani)
  .select(['SR_B3', 'SR_B5'])
  .map(function(image) {
    return image
      .multiply(0.0000275)
      .add(-0.2)
      .copyProperties(image, ['system:time_start']);
  });

// Get filtered collection based on selected dates
var filteredCollection = getFilteredCollection(landsatCollection, selectedDateList);

// Print number of Landsat images
print('Number of Landsat images:', filteredCollection.size());

// Training data preparation
function prepareTrainingData(landsatImage, pHFeatureCollection, tdsCollection, turbidityCollection) {
  var image = ee.Image(landsatImage);
  var imageWithIndices = calculateIndices(image);
  var imageDate = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd');

  // Filter pH, TDS, and Turbidity data for the current date
  var dateFilteredpH = pHFeatureCollection.filter(ee.Filter.equals('date', imageDate));
  var dateFilteredTDS = tdsCollection.filter(ee.Filter.equals('date', imageDate));
  var dateFilteredTurbidity = turbidityCollection.filter(ee.Filter.equals('date', imageDate));

  // Extract features at sampling points
  var trainingPoints = samplingPoints.map(function(point) {
    // Extract spectral indices values
    var values = imageWithIndices.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point.geometry(),
      scale: 30,
      maxPixels: 1e9
    });

    // Find matching measurements
    var matchingpH = dateFilteredpH
      .filter(ee.Filter.equals('station', point.get('Station')))
      .filter(ee.Filter.equals('zone', point.get('Zone')))
      .first();

    var matchingTDS = dateFilteredTDS
      .filter(ee.Filter.equals('station', point.get('Station')))
      .filter(ee.Filter.equals('zone', point.get('Zone')))
      .first();

    var matchingTurbidity = dateFilteredTurbidity
      .filter(ee.Filter.equals('station', point.get('Station')))
      .filter(ee.Filter.equals('zone', point.get('Zone')))
      .first();

    return ee.Feature(point.geometry(), {
      'NIR': values.get('NIR'),
      'B3_B5': values.get('B3_B5'),
      'tdsCombined': ee.Number(ee.Algorithms.If(
        matchingTDS,
        matchingTDS.get('TDS'),
        null
      )),
      'turbidityCombined': ee.Number(ee.Algorithms.If(
        matchingTurbidity,
        matchingTurbidity.get('Turbidity'),
        null
      )),
      'pH': ee.Number(ee.Algorithms.If(
        matchingpH,
        matchingpH.get('pH'),
        null
      )),
      'Station': point.get('Station'),
      'Zone': point.get('Zone'),
      'date': imageDate
    });
  });

  return trainingPoints.filter(ee.Filter.notNull(['pH', 'tdsCombined', 'turbidityCombined']));
}

// Process in-situ data and satellite imagery to create training dataset
var allFeatures = filteredCollection.map(function(image) {
  var imageDate = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd');

  // Filter data for the current date
  var dateFilteredpH = pHCombined.filter(ee.Filter.equals('date', imageDate));
  var dateFilteredTDS = tdsCombined.filter(ee.Filter.equals('date', imageDate));
  var dateFilteredTurbidity = turbidityCombined.filter(ee.Filter.equals('date', imageDate));

  return prepareTrainingData(image, dateFilteredpH, dateFilteredTDS, dateFilteredTurbidity);
}).flatten();

// Ensure dataset is not empty and has required fields
allFeatures = allFeatures.filter(ee.Filter.notNull(['pH', 'tdsCombined', 'turbidityCombined', 'NIR', 'B3_B5']));

// Print total features
print('Total features:', allFeatures.size());

// Add random column for stratified sampling
var seed = 42;
var withRandom = allFeatures.randomColumn('random', seed);

// Split data into training, validation, and testing
var training = withRandom.filter(ee.Filter.lt('random', 0.65));
var validation = withRandom.filter(ee.Filter.and(
  ee.Filter.gte('random', 0.65),
  ee.Filter.lt('random', 0.86)
));
var testing = withRandom.filter(ee.Filter.gte('random', 0.86));

// Print dataset sizes
print('Training set size:', training.size());
print('Validation set size:', validation.size());
print('Testing set size:', testing.size());

// Function to standardize features using z-score normalization
function standardizeFeatures(trainingSet, featureCollections) {
  // List of features to normalize
  var features = ['tdsCombined', 'turbidityCombined', 'NIR', 'B3_B5'];

  // Calculate statistics ONLY from the training set
  var means = {};
  var stdDevs = {};

  features.forEach(function(feat) {
    // Calculate mean
    var meanVal = trainingSet.reduceColumns({
      reducer: ee.Reducer.mean(),
      selectors: [feat]
    }).get('mean');

    // Calculate stdDev
    var stdVal = trainingSet.reduceColumns({
      reducer: ee.Reducer.stdDev(),
      selectors: [feat]
    }).get('stdDev');

    means[feat] = meanVal;
    stdDevs[feat] = stdVal;
  });

  // Convert to dictionaries
  var meanDict = ee.Dictionary(means);
  var stdDict = ee.Dictionary(stdDevs);

  // Apply normalization to all datasets using training set statistics
  var normalizedCollections = featureCollections.map(function(collection) {
    return collection.map(function(feature) {
      var normalized = {};

      features.forEach(function(feat) {
        var val = ee.Number(feature.get(feat));
        var mean = ee.Number(means[feat]);
        var stdDev = ee.Number(stdDevs[feat]);

        // Handle possible division by zero
        var normVal = ee.Algorithms.If(
          stdDev.gt(0),
          val.subtract(mean).divide(stdDev),
          val.subtract(mean)
        );

        normalized[feat] = normVal;
      });

      return feature.set(normalized);
    });
  });

  return {
    normalizedCollections: normalizedCollections,
    means: meanDict,
    stdDevs: stdDict
  };
}

// Standardize features - means and std devs come only from training set
var normalizationResult = standardizeFeatures(
  training,
  [training, validation, testing]
);

var normalizedTraining = normalizationResult.normalizedCollections[0];

// Store means and stdDevs from training for later use in prediction
var meanDict = normalizationResult.means;
var stdDict = normalizationResult.stdDevs;

// Train Random Forest model for pH prediction
var trainedModel = ee.Classifier.smileRandomForest(100)
  .setOutputMode('REGRESSION')
  .train({
    features: normalizedTraining,
    classProperty: 'pH',
    inputProperties: ['tdsCombined', 'turbidityCombined', 'NIR', 'B3_B5']
  });

// Function to normalize prediction images using training statistics
function normalizeImage(image) {
  // Calculate indices first
  var imageWithIndices = calculateIndices(image);

  // Create constant images with mean values from training for TDS and Turbidity
  var tdsValue = meanDict.get('tdsCombined');
  var turbidityValue = meanDict.get('turbidityCombined');

  var tdsImage = ee.Image.constant(tdsValue).rename('tdsCombined');
  var turbidityImage = ee.Image.constant(turbidityValue).rename('turbidityCombined');

  // Add TDS and Turbidity as bands
  var combined = imageWithIndices
    .addBands(tdsImage)
    .addBands(turbidityImage);

  // Apply z-score normalization using training set statistics
  var features = ['tdsCombined', 'turbidityCombined', 'NIR', 'B3_B5'];

  features.forEach(function(feat) {
    var mean = ee.Number(meanDict.get(feat));
    var stdDev = ee.Number(stdDict.get(feat));

    var normBand = ee.Image(ee.Algorithms.If(
      stdDev.gt(0),
      combined.select(feat).subtract(mean).divide(stdDev),
      combined.select(feat).subtract(mean)
    )).rename(feat);

    combined = combined.addBands(normBand, null, true);
  });

  return combined;
}

// =============================================================================
// PREDICTION AND MAPPING SECTION - Monthly Average using toBands()
// =============================================================================
var predictionYear = 2024;
var predictionYearString = predictionYear.toString();

var waterBodies = {
  'Chao_Phraya': Chao_Phraya,
  'Khlong_Nueng': Khlong_Nueng
};

var allPredictedImages = {};

Object.keys(waterBodies).forEach(function(waterBodyName) {
  var waterBody = waterBodies[waterBodyName];

  // Get Landsat collection for the prediction year
  var landsatCollectionYear = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
    .filterBounds(waterBody)
    .filterDate(predictionYearString + '-01-01', predictionYearString + '-12-31')
    .select(['SR_B3', 'SR_B5'])
    .map(function(image) {
      return image
        .multiply(0.0000275)
        .add(-0.2)
        .clip(waterBody)
        .copyProperties(image, ['system:time_start']);
    });

  // Process and normalize images
  var normalizedImagesYear = landsatCollectionYear.map(normalizeImage);

  // Predict pH values
  var predictedImagesYear = normalizedImagesYear.map(function(img) {
    return img
      .classify(trainedModel)
      .rename('pH')
      .copyProperties(img, img.propertyNames())
      .set('water_body', waterBodyName);
  });

  allPredictedImages[waterBodyName] = predictedImagesYear;

  // Print total predicted images for each water body
  predictedImagesYear.size().evaluate(function(size) {
    print(waterBodyName + '_Total_Predicted_Images:', size);
  });

  // Calculate and export monthly average pH images using toBands()
  ee.List.sequence(1, 12).evaluate(function(months) {
    months.forEach(function(month) {
      var startDate = ee.Date.fromYMD(predictionYear, month, 1);
      var endDate = startDate.advance(1, 'month');
      
      var monthlyCollection = predictedImagesYear.filterDate(startDate, endDate);

      var numberOfImages = monthlyCollection.size().getInfo();

      if (numberOfImages > 0) {
        // Create a multiband stack from the monthly collection
        var monthlyStack = monthlyCollection.toBands();

        // Calculate the average of the bands in the stack
        var monthlyMeanImage = monthlyStack.reduce('mean').rename('pH')
          .set('month', startDate.format('YYYY-MM'))
          .set('water_body', waterBodyName);

        var monthString = monthlyMeanImage.get('month').getInfo();
        var wb = monthlyMeanImage.get('water_body').getInfo();
        var exportName = wb + '_pH_MonthlyAvg_' + monthString;

        // EXPORT — Uncomment to generate monthly GeoTIFFs in Google Drive
        /*
        Export.image.toDrive({
          image: monthlyMeanImage,
          description: exportName,
          folder: 'Landsat8_9_pH_Monthly_Avg_Prediction_Images_' + predictionYearString,
          scale: 30,
          crs: 'EPSG:4326',
          region: waterBody,
          fileFormat: 'GeoTIFF',
          maxPixels: 1e13
        });
        */
      } else {
        print('No data for monthly average:', waterBodyName, startDate.format('YYYY-MM').getInfo());
      }
    });
  });
});

// Visualization parameters for pH
var visParams = {
  min: 6.5,
  max: 8.5,
  palette: ['red', 'orange', 'yellow', 'cyan', 'blue']
};

// Visualize example month
var visualizationMonth = '2024-07';
var visualizationStart = ee.Date(visualizationMonth + '-01');
var visualizationEnd = visualizationStart.advance(1, 'month');

// Visualize Chao Phraya pH
var chaoPhrayaImagesVis = allPredictedImages['Chao_Phraya']
  .filter(ee.Filter.date(visualizationStart, visualizationEnd));
var chaoPhrayaMonthlyMeanVis = chaoPhrayaImagesVis.mean();
Map.addLayer(chaoPhrayaMonthlyMeanVis, visParams, 'Chao_Phraya_pH_' + visualizationMonth);

// Visualize Khlong Nueng pH
var khlongNuengImagesVis = allPredictedImages['Khlong_Nueng']
  .filter(ee.Filter.date(visualizationStart, visualizationEnd));
var khlongNuengMonthlyMeanVis = khlongNuengImagesVis.mean();
Map.addLayer(khlongNuengMonthlyMeanVis, visParams, 'Khlong_Nueng_pH_' + visualizationMonth);

Map.centerObject(Pathum_Thani, 12);