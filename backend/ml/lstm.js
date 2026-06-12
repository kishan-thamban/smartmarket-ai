/**
 * Pure JavaScript LSTM Implementation
 * 
 * We use a custom, pure-JS implementation of an LSTM to avoid
 * the heavy dependency and native build requirements of TensorFlow.js
 * on small environments or Windows.
 * 
 * It's sufficient for the small datasets in this project (~30-100 items).
 */

const Math_sigmoid = (t) => 1 / (1 + Math.exp(-t));
const Math_tanh = Math.tanh;

function createMatrix(rows, cols, randomize = false) {
  const m = new Array(rows);
  for (let i = 0; i < rows; i++) {
    m[i] = new Array(cols).fill(0);
    if (randomize) {
      for (let j = 0; j < cols; j++) {
        m[i][j] = (Math.random() - 0.5) * 0.2;
      }
    }
  }
  return m;
}

function createVector(size, randomize = false) {
  const v = new Array(size).fill(0);
  if (randomize) {
    for (let i = 0; i < size; i++) {
      v[i] = (Math.random() - 0.5) * 0.2;
    }
  }
  return v;
}

export class SimpleLSTM {
  constructor(inputSize, hiddenSize, outputSize) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;

    // LSTM Weights (Input, Forget, Cell, Output)
    this.W_f = createMatrix(hiddenSize, inputSize + hiddenSize, true);
    this.b_f = createVector(hiddenSize, true);

    this.W_i = createMatrix(hiddenSize, inputSize + hiddenSize, true);
    this.b_i = createVector(hiddenSize, true);

    this.W_c = createMatrix(hiddenSize, inputSize + hiddenSize, true);
    this.b_c = createVector(hiddenSize, true);

    this.W_o = createMatrix(hiddenSize, inputSize + hiddenSize, true);
    this.b_o = createVector(hiddenSize, true);

    // Output Layer Weights
    this.W_y = createMatrix(outputSize, hiddenSize, true);
    this.b_y = createVector(outputSize, true);
  }

  // Forward pass for a single sequence
  forward(sequence) {
    const hiddenStates = [];
    const cellStates = [];
    
    let h_prev = createVector(this.hiddenSize);
    let c_prev = createVector(this.hiddenSize);

    for (let t = 0; t < sequence.length; t++) {
      const x_t = sequence[t];
      
      // Concat x_t and h_prev
      const concat = [...h_prev, ...x_t];

      // Forget gate
      const f_t = new Array(this.hiddenSize);
      for (let i = 0; i < this.hiddenSize; i++) {
        let sum = this.b_f[i];
        for (let j = 0; j < concat.length; j++) {
          sum += this.W_f[i][j] * concat[j];
        }
        f_t[i] = Math_sigmoid(sum);
      }

      // Input gate
      const i_t = new Array(this.hiddenSize);
      for (let i = 0; i < this.hiddenSize; i++) {
        let sum = this.b_i[i];
        for (let j = 0; j < concat.length; j++) {
          sum += this.W_i[i][j] * concat[j];
        }
        i_t[i] = Math_sigmoid(sum);
      }

      // Candidate cell state
      const c_tilde_t = new Array(this.hiddenSize);
      for (let i = 0; i < this.hiddenSize; i++) {
        let sum = this.b_c[i];
        for (let j = 0; j < concat.length; j++) {
          sum += this.W_c[i][j] * concat[j];
        }
        c_tilde_t[i] = Math_tanh(sum);
      }

      // Current cell state
      const c_t = new Array(this.hiddenSize);
      for (let i = 0; i < this.hiddenSize; i++) {
        c_t[i] = f_t[i] * c_prev[i] + i_t[i] * c_tilde_t[i];
      }

      // Output gate
      const o_t = new Array(this.hiddenSize);
      for (let i = 0; i < this.hiddenSize; i++) {
        let sum = this.b_o[i];
        for (let j = 0; j < concat.length; j++) {
          sum += this.W_o[i][j] * concat[j];
        }
        o_t[i] = Math_sigmoid(sum);
      }

      // Current hidden state
      const h_t = new Array(this.hiddenSize);
      for (let i = 0; i < this.hiddenSize; i++) {
        h_t[i] = o_t[i] * Math_tanh(c_t[i]);
      }

      hiddenStates.push(h_t);
      cellStates.push(c_t);

      h_prev = h_t;
      c_prev = c_t;
    }

    const last_h = hiddenStates[hiddenStates.length - 1];
    const y = new Array(this.outputSize);
    for (let i = 0; i < this.outputSize; i++) {
      let sum = this.b_y[i];
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += this.W_y[i][j] * last_h[j];
      }
      y[i] = sum; // Linear output
    }

    return y[0];
  }

  // Simplified training (gradient descent via backprop through time is complex in raw JS,
  // we will use a naive finite difference method for educational/small scale purposes since 
  // our datasets are very small. For production, use TF.js)
  train(X, Y, epochs = 10, lr = 0.01) {
    // Quick finite difference approximation to avoid 500 lines of BPTT code
    // Only feasible for very small networks and small data (which we have)
    const perturb = 0.001;

    const optimizeParams = (matrix, isMatrix = true) => {
      const rows = isMatrix ? matrix.length : 1;
      const cols = isMatrix ? matrix[0].length : matrix.length;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const arr = isMatrix ? matrix[r] : matrix;
          
          const orig = arr[c];
          
          arr[c] = orig + perturb;
          const lossPlus = this.calculateLoss(X, Y);
          
          arr[c] = orig - perturb;
          const lossMinus = this.calculateLoss(X, Y);
          
          arr[c] = orig;

          const grad = (lossPlus - lossMinus) / (2 * perturb);
          arr[c] = orig - lr * grad;
        }
      }
    };

    for (let epoch = 0; epoch < epochs; epoch++) {
      optimizeParams(this.W_f);
      optimizeParams(this.b_f, false);
      optimizeParams(this.W_i);
      optimizeParams(this.b_i, false);
      optimizeParams(this.W_c);
      optimizeParams(this.b_c, false);
      optimizeParams(this.W_o);
      optimizeParams(this.b_o, false);
      optimizeParams(this.W_y);
      optimizeParams(this.b_y, false);
    }
  }

  calculateLoss(X, Y) {
    let loss = 0;
    for (let i = 0; i < X.length; i++) {
      const pred = this.forward(X[i]);
      loss += Math.pow(pred - Y[i], 2);
    }
    return loss / X.length;
  }
}

// Data normalization
export function normalize(data) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  if (min === max) return { normalized: data.map(() => 0.5), min, max };
  
  return {
    normalized: data.map(d => (d - min) / (max - min)),
    min,
    max
  };
}

export function denormalize(val, min, max) {
  if (min === max) return min;
  return val * (max - min) + min;
}

export function createSequences(data, seqLength) {
  const X = [];
  const Y = [];
  for (let i = 0; i <= data.length - seqLength - 1; i++) {
    X.push(data.slice(i, i + seqLength).map(v => [v]));
    Y.push(data[i + seqLength]);
  }
  return { X, Y };
}

/**
 * Generate LSTM Forecast
 * @param {Array} salesHistory array of sales numbers sorted by date
 * @param {number} horizon days to forecast
 */
export function generateLSTMForecast(salesHistory, horizon = 30) {
  const seqLength = 7; // Weekly pattern

  if (salesHistory.length < 14) {
    return { error: "insufficient_data" };
  }

  const { normalized, min, max } = normalize(salesHistory);
  const { X, Y } = createSequences(normalized, seqLength);

  const lstm = new SimpleLSTM(1, 8, 1);
  
  // Train
  lstm.train(X, Y, 20, 0.1); 

  // Forecast
  let currentSeq = normalized.slice(-seqLength).map(v => [v]);
  const predictions = [];

  for (let i = 0; i < horizon; i++) {
    const nextValNorm = lstm.forward(currentSeq);
    const nextVal = denormalize(nextValNorm, min, max);
    
    predictions.push(Math.max(0, Math.round(nextVal)));

    currentSeq.shift();
    currentSeq.push([nextValNorm]);
  }

  // Calculate training RMSE & MAPE for metrics
  let sumSqErr = 0;
  let sumApe = 0;
  let apeCount = 0;

  for (let i = 0; i < X.length; i++) {
    const predNorm = lstm.forward(X[i]);
    const pred = denormalize(predNorm, min, max);
    const actual = denormalize(Y[i], min, max);

    sumSqErr += Math.pow(pred - actual, 2);
    if (actual > 0) {
      sumApe += Math.abs((actual - pred) / actual);
      apeCount++;
    }
  }

  const rmse = Math.sqrt(sumSqErr / X.length);
  const mape = apeCount > 0 ? (sumApe / apeCount) * 100 : null;

  return {
    predictions,
    metrics: {
      rmse: parseFloat(rmse.toFixed(2)),
      mape: mape !== null ? parseFloat(mape.toFixed(2)) : null
    },
    residual_std: rmse || 1
  };
}
